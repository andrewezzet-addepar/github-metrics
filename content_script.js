console.log('[github-metrics] chrome extension loaded');
const LINK_ATTR = 'data-chrome-extension-linked';
const TESTS_SELECTOR = `#qunit-tests > li > strong:not([${LINK_ATTR}])`;
const PASSED_TESTS_SELECTOR = `#qunit-tests > li.pass > strong[${LINK_ATTR}]`;

const teamMembers = [
  // 'twesely',
  // 'aberman-addepar',
  // 'addemike',
  'andrewezzet-addepar',
  // 'c69-addepar',
  // 'john-addepar'
];

function addMetricsButton() {
  let anchor = document.querySelector('notification-indicator').parentElement;
  let button = document.createElement('button');
  button.style = 'margin-right: 48px;';
  button.innerText = 'Metrics';
  anchor.insertAdjacentElement('beforebegin', button);
  button.onclick = async function() {
    button.innerText = 'Loading...';
    await runMetrics();
    button.innerText = 'Metrics';
  }
}

addMetricsButton();

async function runMetrics() {
  console.log('running metrics');

  let ampData = await fetchPRs('AMP');
  let iversonData = await fetchPRs('Iverson');

  console.log('issues', ampData, iversonData);

  let categorizedAmpIssues = {};
  let categorizedIversonIssues = {};
  for (let username of teamMembers) {
    categorizedAmpIssues[username] = categorizeIssues(ampData[username]);
    categorizedIversonIssues[username] = categorizeIssues(iversonData[username]);
  }

  console.log('categorized issues', categorizedAmpIssues, categorizedIversonIssues);
}

const DRAFT = 'draft';
const PREVIOUS = 'old';
const MERGED = 'merged';
const OPENED = 'opened';

const REOPENED = 'reopened';
const READY_FOR_REVIEW = 'ready_for_review';
const REVIEW_REQUESTED = 'review_requested';

function categorizeIssues(issues) {
  let categories = { [DRAFT]: [], [PREVIOUS]: [], [OPENED]: [], [MERGED]: [] };
  for (let issue of issues) {
    let category = getCategory(issue);
    categories[category].push(issue);
  }
  return categories;
}

function getCategory(issue) {
  let { pull_request } = issue;
  let { opened_at, merged_at, draft } = pull_request;

  if (draft) {
    return DRAFT;
  } else if (merged_at) {
    return MERGED;
  } else if (opened_at > start) {
    return OPENED;
  } else {
    return PREVIOUS;
  }
}

function combineMetrics(base, added) {
  metrics.total = combineMetrics(metrics.total, userMetrics);

  base.outstanding += added.outstanding;
  base.newlyOpened += added.newlyOpened;
  base.merged += added.merged;
}

const username = 'andrewezzet-addepar';
const token = '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';
const start = "2021-05-24T00:00:00.000Z";

class HttpClient {
  constructor(username, token) {
    this.options = { 
      headers: new Headers({ 
        'Authorization': 'Basic ' + btoa(`${username}:${token}`),
        'Accept': 'application/vnd.github.v3+json',
      }),
    };
  }

  options;

  async GET(url) {
    return fetch(url, this.options)
      .then(res => res.json())
  }
}

let http;

async function fetchPRs(repo) {
  console.log('fetching data');

  if (!http) {
    http = new HttpClient(username, token);
  }

  const issuesUrl = `https://api.github.com/repos/addepar/${repo}/issues`;

  let openIssuesPromises = {};
  let mergedIssuesPromises = {};
  for (let username of teamMembers) {
    openIssuesPromises[username] = http.GET(`${issuesUrl}?creator=${username}&pulls=true&state=open`);
    mergedIssuesPromises[username] = http.GET(`${issuesUrl}?creator=${username}&pulls=true&state=closed&since=${start}`);
  }

  let issuesById = {};
  let pullPromises = {};
  let eventPromises = {};
  let issuesByAuthor = {};

  // fetch issues for each user
  for (let username of teamMembers) {
    let openIssues = await openIssuesPromises[username];
    let mergedIssues = await mergedIssuesPromises[username];
    let allIssues = openIssues.concat(mergedIssues);
    issuesByAuthor[username] = allIssues;

    // fetch pr and events for each issue
    for (let issue of allIssues) {
      let id = issue.number;
      issuesById[id] = issue;
      pullPromises[id] = http.GET(issue.pull_request.url);
      eventPromises[id] = http.GET(`${issuesUrl}/${id}/events`);
    }
  }

  for (let [id, issue] of Object.entries(issuesById)) {
    issue.events = await eventPromises[id];
    issue.pull_request = await pullPromises[id];
    issue.pull_request.opened_at = getOpenedForReviewDate(issue);
  }

  return issuesByAuthor;
}

/**
 * thanks to @bantic for the logic here!
 */
function getOpenedForReviewDate(issue) {
  let { events, pull_request } = issue;
  let { merged_at } = pull_request;

  // if it was closed, ignore events before it was last reopened
  let lastReopened = events.reverse().find(({ event }) => event === REOPENED);
  if (lastReopened) {
    events = events.slice(events.indexOf(lastReopened));
  }

  let lastReadyForReview = events.reverse().find(({ event }) => event === READY_FOR_REVIEW);

  // if review was requested after merging, ignore
  let firstReviewRequested = events.find(({ event, created_at }) => event === REVIEW_REQUESTED && (!merged_at || merged_at > created_at));

  let openedForReview = lastReadyForReview || firstReviewRequested || lastReopened || pull_request
  return openedForReview.created_at;
}
