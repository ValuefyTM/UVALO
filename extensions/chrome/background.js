// Deschide panoul lateral la click pe iconița extensiei
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error(e));
