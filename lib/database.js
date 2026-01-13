'use strict';

const { stripHTML } = require('hexo-util');

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function toSerializable(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;

  if (value instanceof Date) {
    const ts = value.getTime();
    return isNaN(ts) ? undefined : value.toISOString();
  }

  if (Array.isArray(value)) {
    // Keep arrays, but only if items are serializable.
    const arr = value
      .map(v => toSerializable(v))
      .filter(v => v !== undefined);
    return arr;
  }

  if (isPlainObject(value)) {
    // Keep plain objects, but drop non-serializable members.
    const obj = {};
    Object.keys(value).forEach(k => {
      const v = toSerializable(value[k]);
      if (v !== undefined) obj[k] = v;
    });
    return obj;
  }

  // Drop functions / class instances / buffers / heavy objects.
  return undefined;
}

function addExtraFields(data, article) {
  const reserved = new Set([
    'title',
    'path',
    'url',
    'content',
    '_content',
    'categories',
    'tags'
  ]);

  // Avoid polluting search.json with heavy/internal Hexo fields.
  const ignored = new Set([
    // Hexo internals / derived fields
    'source',
    'raw',
    'excerpt',
    'more',
    'permalink',
    'full_source',
    'asset_dir',
    'cover_type',
    'slug',
    'published',
    'comments',
    'layout',
    'photos',
    'updated',
    'created'
  ]);

  // Some Hexo objects may keep front-matter under different keys.
  const candidates = [];
  if (article && typeof article === 'object') candidates.push(article);
  if (article && article.data && typeof article.data === 'object') candidates.push(article.data);
  if (article && article.frontMatter && typeof article.frontMatter === 'object') candidates.push(article.frontMatter);
  if (article && article.front_matter && typeof article.front_matter === 'object') candidates.push(article.front_matter);

  for (const candidate of candidates) {
    for (const key of Object.keys(candidate)) {
      if (!key || reserved.has(key)) continue;
      if (ignored.has(key)) continue;
      if (key.startsWith('_')) continue;
      if (key in data) continue;

      const serializable = toSerializable(candidate[key]);
      if (serializable === undefined) continue;

      // Skip very long strings (usually raw/HTML or huge blobs).
      if (typeof serializable === 'string' && serializable.length > 600) continue;

      // Prevent extremely large payloads from bloating search.json.
      try {
        const size = JSON.stringify(serializable).length;
        if (size > 4000) continue;
      } catch (e) {
        continue;
      }

      data[key] = serializable;
    }
  }
}

function savedb(article, config, isPost) {
  const data = {};
  if (article.title) {
    data.title = article.title;
  }
  if (article.path) {
    data.url = encodeURI(config.root + article.path);
  }
  if (config.search.content !== false) {
    if (config.search.format === 'raw') {
      data.content = article._content;
    } else {
      data.content = article.content.replace(/<td class="gutter">.*?<\/td>/g, '');
      if (config.search.format === 'striptags') {
        data.content = stripHTML(data.content);
      }
    }
  } else {
    data.content = '';
  }
  if (!isPost) {
    return data;
  }
  if (article.categories && article.categories.length > 0) {
    data.categories = article.categories.map(category => category.name);
  }
  if (article.tags && article.tags.length > 0) {
    data.tags = article.tags.map(tag => tag.name);
  }

  // Keep common fields explicit for stability.
  if (article.cover) data.cover = article.cover;
  if (article.date) data.date = article.date;

  // Auto collect extra front-matter fields.
  addExtraFields(data, article);
  
  return data;
}

function getTime(value) {
  if (!value) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (value instanceof Date) {
    const ts = value.getTime();
    return isNaN(ts) ? 0 : ts;
  }
  if (typeof value === 'string') {
    const ts = new Date(value).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  if (typeof value === 'object' && typeof value.valueOf === 'function') {
    const v = value.valueOf();
    if (typeof v === 'number' && !isNaN(v)) return v;
    const ts = new Date(v).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  return 0;
}

module.exports = function (locals, config) {
  const searchfield = config.search.field;
  const database = [];
  if (searchfield === 'all' || searchfield === 'post') {
    locals.posts.forEach(post => {
      const data = savedb(post, config, true);
      if (typeof post.hide !== 'undefined' && post.hide) { } else {
        database.push(data);
      }
    });
  }
  if (searchfield === 'all' || searchfield === 'page') {
    locals.pages.forEach(page => {
      const data = savedb(page, config);
      if (typeof page.hide !== 'undefined' && page.hide) { } else {
        database.push(data);
      }
    });
  }
  database.sort((a, b) => getTime(b.date) - getTime(a.date));
  return database;
};
