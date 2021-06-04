console.log('[github-metrics] chrome extension loaded');
const LINK_ATTR = 'data-chrome-extension-linked';
const TESTS_SELECTOR = `#qunit-tests > li > strong:not([${LINK_ATTR}])`;
const PASSED_TESTS_SELECTOR = `#qunit-tests > li.pass > strong[${LINK_ATTR}]`;

const username = 'andrewezzet-addepar';
const token = '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';

const teamMembers = [
  // 'twesely',
  // 'aberman-addepar',
  // 'addemike',
  'andrewezzet-addepar',
  // 'c69-addepar',
  // 'john-addepar'
];

function addMetricsButton() {
  console.log('adding button');
  const anchor = document.querySelector('notification-indicator').parentElement;
  let button = document.createElement('button');
  button.style = 'margin-right: 48px;';
  button.innerText = 'Metrics';
  anchor.insertAdjacentElement('beforebegin', button);
  button.onclick = () => runMetrics();
}

addMetricsButton();

async function runMetrics() {
  console.log('running metrics');

  let ampData = await fetchPRs('AMP');
  let iversonData = await fetchPRs('Iverson');

  console.log(ampData, iversonData);
}

async function fetchPRs(repo) {
  console.log('fetching data');

  let authToken = btoa(username + ':' + token);
  console.log(authToken);

  const options = { 
    headers: new Headers({ 
      'Authorization': 'Basic ' + authToken,
      'Accept': 'application/vnd.github.v3+json',
    }),
  };

  function httpGet(url) {
    return fetch(url, options);
  }

  const issuesUrl = `https://api.github.com/repos/addepar/${repo}/issues`;

  let issuePromises = {};
  for (let username of teamMembers) {
    issuePromises[username] = httpGet(`${issuesUrl}?pulls=true&creator=${username}`);
  }

  let issuesById = {};
  let pullPromises = {};
  let eventPromises = {};
  let issuesByAuthor = {};

  // fetch issues for each user
  for (let [username, promise] of Object.entries(issuePromises)) {
    let response = await promise;
    let data = await response.json();

    // fetch pr and events for each issue
    for (let issue of data) {
      let id = issue.number;
      issuesById[id] = issue;
      pullPromises[id] = httpGet(issue.pull_request.url);
      eventPromises[id] = httpGet(`${issuesUrl}/${id}/events`);
    }
    issuesByAuthor[username] = data;
  }

  for (let [id, promise] of Object.entries(pullPromises)) {
    let response = await promise;
    issuesById[id].pull_request = await response.json();
  }

  for (let [id, promise] of Object.entries(eventPromises)) {
    let response = await promise;
    issuesById[id].events = await response.json();
  }

  return issuesByAuthor;
}
