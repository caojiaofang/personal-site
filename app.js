// 筛选只改变当前列表，不会中断正在运行的专注时钟。
const filterButtons = [...document.querySelectorAll('[data-project-filter]')];
const projectCards = [...document.querySelectorAll('[data-project-category]')];
filterButtons.forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.projectFilter;
  let count = 0;
  projectCards.forEach(card => {
    card.hidden = selected !== 'all' && card.dataset.projectCategory !== selected;
    if (!card.hidden) count++;
  });
  filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#project-feedback').textContent = `显示 ${count} 个作品`;
}));

const noteSearch = document.querySelector('#note-search');
const noteRows = [...document.querySelectorAll('[data-note-search]')];
let searchAnnounce;
function filterNotes() {
  const query = noteSearch.value.trim().toLocaleLowerCase();
  let count = 0;
  noteRows.forEach(row => {
    row.hidden = !row.dataset.noteSearch.toLocaleLowerCase().includes(query);
    if (!row.hidden) count++;
  });
  document.querySelector('.notes-empty').hidden = count !== 0;
  clearTimeout(searchAnnounce);
  searchAnnounce = setTimeout(() => {
    document.querySelector('#search-feedback').textContent = query ? `找到 ${count} 篇记录` : '';
  }, 200);
}
noteSearch?.addEventListener('input', filterNotes);
document.querySelector('#clear-note-search')?.addEventListener('click', () => {
  noteSearch.value = '';
  filterNotes();
  noteSearch.focus();
});
