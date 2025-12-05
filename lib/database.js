document.addEventListener('DOMContentLoaded', function () {
  const categoryItems = document.querySelectorAll('.category-nav-item');
  const tagItems = document.querySelectorAll('.tag-nav-item');
  const yearItems = document.querySelectorAll('.year-nav-item');
  const postContainer = document.querySelector('#recent-posts .recent-post-items') || document.querySelector('#recent-posts');
  const postsPerLoad = 20;

  // 复用 search.json 作为数据源，避免只筛选首屏 DOM
  const siteRoot = ((window?.CONFIG?.root || window?.GLOBAL_CONFIG?.root || '/').replace(/\/?$/, '/'));
  const searchJsonUrl = `${siteRoot}search.json`;

  const allPosts = [];
  let filteredPosts = [];
  let currentLoadIndex = postsPerLoad;
  let isLoading = false;
  let currentCategory = 'all';
  let currentTag = 'all';
  let currentYear = 'all';

  // 隐藏原有分页和动态加载
  const pagination = document.querySelector('.pagination');
  if (pagination) pagination.style.display = 'none';
  const loadMoreWrap = document.querySelector('.load-more-wrap');
  if (loadMoreWrap) {
    loadMoreWrap.style.display = 'none';
    loadMoreWrap.getBoundingClientRect = () => ({ top: Infinity });
    const btn = loadMoreWrap.querySelector('.load-more-btn');
    if (btn) {
      btn.disabled = true;
      btn.onclick = (e) => e.preventDefault();
    }
  }

  const loadingElement = document.createElement('div');
  loadingElement.className = 'loading-more';
  loadingElement.style.cssText = 'text-align: center; padding: 20px; display: none;';
  loadingElement.innerHTML = '加载中...';
  if (postContainer?.parentNode) {
    postContainer.parentNode.insertBefore(loadingElement, postContainer.nextSibling);
  }

  function resetCategoryActive() {
    categoryItems.forEach(cat => cat.classList.remove('active'));
    if (categoryItems[0]) categoryItems[0].classList.add('active');
    currentCategory = 'all';
  }

  function resetTagActive() {
    tagItems.forEach(tag => tag.classList.remove('active'));
    if (tagItems[0]) tagItems[0].classList.add('active');
    currentTag = 'all';
  }

  function resetYearActive() {
    yearItems.forEach(year => year.classList.remove('active'));
    if (yearItems[0]) yearItems[0].classList.add('active');
    currentYear = 'all';
  }

  function stripHtml(html = '') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function normalizePosts(searchData) {
    return searchData
      .filter(item => item.url && item.url.includes('/p/')) // 只要文章，不要分类/关于等页面
      .map(item => {
        const absoluteUrl = item.url.startsWith('http') ? item.url : `${siteRoot.replace(/\/$/, '')}${item.url}`;
        const dateObj = item.date ? new Date(item.date) : null;
        const year = dateObj && !Number.isNaN(dateObj.getTime()) ? String(dateObj.getFullYear()) : '';
        const dateText = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toISOString().slice(0, 10) : '';
        const excerpt = stripHtml(item.content || '').trim().slice(0, 160);
        return {
          title: item.title || '未命名',
          url: absoluteUrl,
          categories: item.categories || [],
          tags: item.tags || [],
          cover: item.cover || '',
          year,
          dateText,
          excerpt
        };
      });
  }

  function renderPostCard(post) {
    const wrapper = document.createElement('div');
    wrapper.className = 'recent-post-item';

    const hasCover = !!post.cover;

    if (hasCover) {
      const coverWrap = document.createElement('div');
      coverWrap.className = 'post_cover';
      const link = document.createElement('a');
      link.href = post.url;
      link.title = post.title;
      const img = document.createElement('img');
      img.className = 'post-bg';
      img.src = post.cover;
      img.alt = post.title;
      link.appendChild(img);
      coverWrap.appendChild(link);
      wrapper.appendChild(coverWrap);
    }

    const info = document.createElement('div');
    info.className = hasCover ? 'recent-post-info' : 'recent-post-info no-cover';

    const titleLink = document.createElement('a');
    titleLink.className = 'article-title';
    titleLink.href = post.url;
    titleLink.textContent = post.title;
    info.appendChild(titleLink);

    const metaWrap = document.createElement('div');
    metaWrap.className = 'article-meta-wrap';

    if (post.dateText) {
      const dateSpan = document.createElement('span');
      dateSpan.className = 'post-meta-date';
      dateSpan.textContent = post.dateText;
      metaWrap.appendChild(dateSpan);
    }

    if (post.categories.length > 0) {
      const catSpan = document.createElement('span');
      catSpan.className = 'article-meta';
      post.categories.forEach((cat, idx) => {
        const sep = document.createElement('span');
        sep.className = 'article-meta-separator';
        sep.textContent = idx === 0 ? '|' : '';
        if (idx === 0) catSpan.appendChild(sep);

        const icon = document.createElement('i');
        icon.className = 'fas fa-inbox';
        catSpan.appendChild(icon);

        const link = document.createElement('a');
        link.className = 'article-meta__categories';
        link.textContent = cat;
        catSpan.appendChild(link);

        if (idx < post.categories.length - 1) {
          const arrow = document.createElement('i');
          arrow.className = 'fas fa-angle-right article-meta-link';
          catSpan.appendChild(arrow);
        }
      });
      metaWrap.appendChild(catSpan);
    }

    if (post.tags.length > 0) {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'article-meta tags';

      const sep = document.createElement('span');
      sep.className = 'article-meta-separator';
      sep.textContent = '|';
      tagSpan.appendChild(sep);

      post.tags.forEach((tag, idx) => {
        const icon = document.createElement('i');
        icon.className = 'fas fa-tag';
        tagSpan.appendChild(icon);

        const link = document.createElement('a');
        link.className = 'article-meta__tags';
        link.textContent = tag;
        tagSpan.appendChild(link);

        if (idx < post.tags.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'article-meta-link';
          arrow.textContent = '·';
          tagSpan.appendChild(arrow);
        }
      });

      metaWrap.appendChild(tagSpan);
    }

    info.appendChild(metaWrap);

    if (post.excerpt) {
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = post.excerpt;
      info.appendChild(content);
    }

    wrapper.appendChild(info);
    return wrapper;
  }

  function filterPosts() {
    return allPosts.filter(post => {
      const categoryMatch = currentCategory === 'all' ||
        post.categories.includes(currentCategory);

      const tagMatch = currentTag === 'all' ||
        post.tags.includes(currentTag);

      const yearMatch = currentYear === 'all' ||
        (post.year && post.year === currentYear);

      return categoryMatch && tagMatch && yearMatch;
    });
  }

  function showMorePosts() {
    if (isLoading || !postContainer) return;
    if (currentLoadIndex >= filteredPosts.length) {
      loadingElement.style.display = 'none';
      return;
    }
    isLoading = true;
    loadingElement.style.display = 'block';

    setTimeout(() => {
      const fragment = document.createDocumentFragment();
      for (let i = currentLoadIndex - postsPerLoad; i < currentLoadIndex && i < filteredPosts.length; i++) {
        fragment.appendChild(renderPostCard(filteredPosts[i]));
      }
      postContainer.appendChild(fragment);

      currentLoadIndex += postsPerLoad;
      isLoading = false;
      loadingElement.style.display =
        currentLoadIndex >= filteredPosts.length ? 'none' : 'block';
    }, 150);
  }

  function updatePosts() {
    currentLoadIndex = postsPerLoad;
    filteredPosts = filterPosts();

    if (postContainer) postContainer.innerHTML = '';

    if (!filteredPosts.length) {
      const noPostsMessage = document.createElement('div');
      noPostsMessage.className = 'no-posts-message';
      noPostsMessage.textContent = '没有找到相关项目';
      postContainer?.appendChild(noPostsMessage);
      loadingElement.style.display = 'none';
    } else {
      showMorePosts();
    }
  }

  function onScrollLoad() {
    if (!postContainer || isLoading) return;
    // 当滚动接近底部 240px 时加载更多
    const rect = loadingElement.getBoundingClientRect();
    if (rect.top < window.innerHeight + 240) {
      showMorePosts();
    }
  }

  function bindFilters() {
    categoryItems.forEach(item => {
      item.addEventListener('click', function () {
        categoryItems.forEach(cat => cat.classList.remove('active'));
        this.classList.add('active');
        currentCategory = this.dataset.category;

        resetTagActive();
        resetYearActive();

        updatePosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    tagItems.forEach(item => {
      item.addEventListener('click', function () {
      tagItems.forEach(tag => tag.classList.remove('active'));
      this.classList.add('active');
      currentTag = this.dataset.tag;

      resetCategoryActive();
      resetYearActive();

      updatePosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  yearItems.forEach(item => {
    item.addEventListener('click', function () {
      yearItems.forEach(year => year.classList.remove('active'));
      this.classList.add('active');
      currentYear = this.dataset.year;

      resetCategoryActive();
      resetTagActive();
      updatePosts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  }

  async function init() {
    try {
      loadingElement.style.display = 'block';
      const searchRes = await fetch(searchJsonUrl, { credentials: 'same-origin' });
      const searchData = await searchRes.json();

      allPosts.push(...normalizePosts(searchData));
      filteredPosts = allPosts;
      bindFilters();
      updatePosts();
      window.addEventListener('scroll', onScrollLoad, { passive: true });
    } catch (err) {
      console.error('加载数据失败', err);
      loadingElement.style.display = 'none';
    }
  }

  init();
});
