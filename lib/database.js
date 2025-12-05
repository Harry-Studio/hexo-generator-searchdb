'use strict';

const { stripHTML } = require('hexo-util');

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
  if (article.cover) {
    data.cover = article.cover;
  }
  if (article.date) {
    data.date = article.date;
  }

  if (article.hide) {
    data.hide = article.hide;
  }
  if (article.urlname) {
    data.urlname = article.urlname;
  }
  if (article.outsource) {
    data.outsource = article.outsource;
  }
  if (article.type) {
    data.type = article.type;
  }
  
  return data;
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
  return database;
};
