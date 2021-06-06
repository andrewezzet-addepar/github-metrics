console.log('[github-metrics] chrome extension loaded');
const LINK_ATTR = 'data-chrome-extension-linked';
const TESTS_SELECTOR = `#qunit-tests > li > strong:not([${LINK_ATTR}])`;
const PASSED_TESTS_SELECTOR = `#qunit-tests > li.pass > strong[${LINK_ATTR}]`;

const teamMembers = [
  'twesely',
  'aberman-addepar',
  'addemike',
  'andrewezzet-addepar',
  'c69-addepar',
  'john-addepar'
];

function addMetricsButton() {
  let anchor = document.querySelector('notification-indicator').parentElement;
  let button = document.createElement('button');
  button.style = 'margin-right: 48px;';
  button.innerText = 'Metrics';
  anchor.insertAdjacentElement('beforebegin', button);
  button.onclick = async function() {
    button.innerText = 'Loading...';
    await runMetrics2();
    button.innerText = 'Metrics';
  }
}

addMetricsButton();

let AMP = 'AMP';
let IVERSON = 'Iverson';
let REPOS = [AMP, IVERSON];

class Metrics {
  constructor(issues) {
    this.issues = issues;
  }

  getIssues({ repo, author, tags }) {
    return this.issues.filter(issue => {
      return (!repo || issue.repo === repo)
        && (!author || issue.author === author)
    });
  }

  getRepoMetrics(repo, { categorizeBy }) {
    let issues = this.getIssues({ repo });
    return this.getMetrics(issues, categorizeBy);
  }

  getUserMetrics(author, { categorizeBy }) {
    let issues = this.getIssues({ author });
    return this.getMetrics(issues, categorizeBy);
  }

  getMetrics(issues, categorizeBy) {
    let metrics = {
      counts: this.getCounts(issues, categorizeBy),
      timings: this.getTimings(issues, categorizeBy),
    };
    return metrics;
  }

  getCounts(issues, categorizeBy) {
    let counts = { all: new CountMetrics() };
    for (let issue of issues) {
      if (categorizeBy) {
        let category = issue[categorizeBy];
        if (!counts[category]) {
          counts[category] = new CountMetrics();
        }
        counts[category].addIssue(issue);
      }
      counts.all.addIssue(issue);
    }
    return counts;
  }

  getTimings(issues, categorizeBy) {
    let timings = { all: new TimingMetrics() };
    for (let issue of issues) {
      if (categorizeBy) {
        let category = issue[categorizeBy];
        if (!timings[category]) {
          timings[category] = new TimingMetrics();
        }
        timings[category].addIssue(issue);
      }
      timings.all.addIssue(issue);
    }
    return timings;
  }
}

async function runMetrics2() {
  console.log('running metrics');

  let data = [];
  for (let repo of REPOS) {
    data = data.concat(await fetchPRs2(repo));
  }

  let metrics = new Metrics(data);

  let resultsByRepo = {};
  for (let repo of REPOS) {
    resultsByRepo[repo] = metrics.getRepoMetrics(repo, { categorizeBy: 'author' });
  }
  resultsByRepo.all = aggregateMetrics(resultsByRepo);

  let resultsByAuthor = {};
  for (let username of teamMembers) {
    resultsByAuthor[username] = metrics.getUserMetrics(username, { categorizeBy: 'repo' });
  }
  resultsByAuthor.all = aggregateMetrics(resultsByAuthor);

  console.log(resultsByRepo, resultsByAuthor);
  console.log(JSON.stringify(resultsByRepo, null, 2));
  console.log(JSON.stringify(resultsByAuthor, null, 2));
  renderMetrics(
    { title: 'Results by Repo', metrics: resultsByRepo }, 
    { title: 'Results by Author', metrics: resultsByAuthor },
  );
}

function aggregateMetrics(metrics) {
  let total = { counts: new CountMetrics(), timings: new TimingMetrics() }
  for (let category of Object.keys(metrics)) {
    let { counts, timings } = metrics[category];
    total.counts.addCounts(counts.all);
    total.timings.addTimings(timings.all);
  }
  return total;
}

function renderMetrics(...titledMetrics) {
  let modal = document.createElement('div');
  modal.style = `
    position: absolute; 
    top: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #00000033;
  `;

  modal.appendChild(MetricsModal(titledMetrics));
  document.querySelector('body').appendChild(modal);
}

function MetricsModal(titledMetrics) {
  let modalDiv = document.createElement('div');
  modalDiv.style = `
    background: white;
    padding: 8px 16px 16px;
    border: 4px solid aliceblue;
    box-shadow: 5px 5px 10px 0px gray;
  `;

  modalDiv.innerHTML = ModalHeader('Metrics');

  for (let { title, metrics } of titledMetrics) {
    modalDiv.appendChild(MetricsTable(title, metrics));
  }
  return modalDiv;
}

function ModalHeader(title) {
  return `<h3>${title}</h3>`;
}

function MetricsTable(title, metrics) {
  let tableDiv = document.createElement('div');
  tableDiv.style = `
    margin-top: 24px;
  `;

  tableDiv.innerHTML = `
    <style>
      table, th, td {
        border: 1px solid lightgray;
        padding: 4px;
        text-align: start;
        width: 100%
      }
      table {
        border-collapse: collapse;
      }
    </style>
    ${Header(title)}
    <table>
      <thead>
        ${TableHeaderRow([...TAGS, ...TIMINGS])}
      </thead>
      <tbody>
        ${Object.entries(metrics).map(renderCategory).join('')}
      </tbody>
    </table>
  `;
  return tableDiv;
}

function formatDate(date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

function Header(title) {
  let startDate = new Date(start);
  let endDate = new Date();
  return `
    <h4 style="margin-bottom: 8px">
      ${title} (${formatDate(startDate)} - ${formatDate(endDate)})
    </h4>
  `;
}

function TableHeaderRow(columns) {
  return `
    <tr>
      <th></th>
      ${columns.map(HeaderCell).join('')}
    </tr>
  `;
}

function HeaderCell(headerName) {
  return `<th>${headerName}</th>`;
}

function TableCell(value) {
  return `<td>${value}</td>`;
}

function renderCategory([category, metrics]) {
  let counts = metrics.counts.all ?? metrics.counts;
  let timings = metrics.timings.all ?? metrics.timings;
  return `
    <tr>
      ${HeaderCell(category)}
      ${renderCounts(counts)}
      ${renderTimings(timings)}
    </tr>
  `;
}

function renderCounts(counts) {
  return TAGS.map(tag => TableCell(counts[tag])).join('');
}

function renderTimings(timings) {
  return `
    ${TableCell(humanizeDuration(timings.avgTimeToMerge))}
    ${TableCell(humanizeDuration(timings.avgTimeToReview))}
  `;
}

class CountMetrics {
  constructor() {
    this.draft = 0;
    this.old = 0;
    this.new = 0;
    this.merged = 0;
    this.outstanding = 0;
  }

  addCounts(counts) {
    this.draft += counts.draft;
    this.old += counts.old;
    this.new += counts.new;
    this.merged += counts.merged;
    this.outstanding += counts.outstanding;
  }

  addIssue(issue) {
    for (let tag of issue.tags) {
      this[tag] += 1;
    }
  }
}

class TimingMetrics {
  constructor() {
    this.time_to_merge = [];
    this.time_to_review = [];
  }

  addTimings(timings) {
    this.time_to_merge = this.time_to_merge.concat(timings.time_to_merge);
    this.time_to_review = this.time_to_review.concat(timings.time_to_review);
  }

  addIssue(issue) {
    if (issue.tags.includes(MERGED)) {
      this.time_to_merge.push(issue.pull_request.time_to_merge);
      this.time_to_review.push(issue.pull_request.time_to_review);
    }
  }

  get totalTimeToMerge() {
    return this.time_to_merge.reduce((acc, time) => acc + time, 0);
  }

  get totalTimeToReview() {
    return this.time_to_review.reduce((acc, time) => acc + time, 0);
  }

  get avgTimeToMerge() {
    return this.totalTimeToMerge / this.time_to_merge.length;
  }

  get avgTimeToReview() {
    return this.totalTimeToReview / this.time_to_review.length;
  }
}

function humanizeDuration(millis) {
  if (isNaN(millis)) {
    return null;
  }

  function parseTime(millis) {
    let seconds = millis / 1000;
    if (seconds < 1) {
      return [millis, 'ms'];
    }
  
    let minutes = seconds / 60;
    if (minutes < 1) {
      return [seconds, 'seconds'];
    }
  
    let hours = minutes / 60;
    if (hours < 1) {
      return [minutes, 'minutes'];
    }
  
    let days = hours / 24;
    if (days < 1) {
      return [hours,'hours'];
    }
  
    return [days, 'days'];
  }

  // let [value, unit] = parseTime(millis);
  let [value, unit] = [millis / 1000 / 60 / 60, 'hours'];

  let maxDecimals = 1;

  let charsAfterDecimal = value.toString().split('.')[1];
  let decimals = charsAfterDecimal ? Math.max(0, charsAfterDecimal.length) : 0;
  return `${value.toFixed(Math.min(decimals, maxDecimals))} ${unit}`;
}

const DRAFT = 'draft';
const OLD = 'old';
const NEW = 'new';
const MERGED = 'merged';
const OUTSTANDING = 'outstanding';
const TAGS = [DRAFT, OLD, NEW, MERGED, OUTSTANDING];

const TIME_TO_MERGE = 'time_to_merge';
const TIME_TO_REVIEW = 'time_to_review';
const TIMINGS = [TIME_TO_MERGE, TIME_TO_REVIEW];

const REOPENED = 'reopened';
const READY_FOR_REVIEW = 'ready_for_review';
const REVIEW_REQUESTED = 'review_requested';

const username = 'andrewezzet-addepar';
const token = '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';
const start = "2021-05-24T00:00:00.000Z";
const today = new Date().toISOString();

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
    return fetch(url, this.options).then(res => res.json())
  }
}

let http;

async function fetchPRs2(repo) {
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
  let reviewPromises = {};

  // fetch issues for each user
  for (let username of teamMembers) {
    let openIssues = await openIssuesPromises[username];
    let mergedIssues = await mergedIssuesPromises[username];
    let allIssues = openIssues.concat(mergedIssues);

    // fetch pr, events, and reviews for each issue
    for (let issue of allIssues) {
      let id = issue.number;
      issuesById[id] = issue;
      pullPromises[id] = http.GET(issue.pull_request.url);
      eventPromises[id] = http.GET(`${issuesUrl}/${id}/events`);
      reviewPromises[id] = http.GET(`${issue.pull_request.url}/reviews`);
    }
  }

  // enrich data
  for (let [id, issue] of Object.entries(issuesById)) {
    issue.repo = repo;
    issue.author = issue.user.login;
    issue.events = await eventPromises[id];
    issue.reviews = await reviewPromises[id];
    issue.pull_request = await pullPromises[id];

    // if it was ever closed, ignore events and reviews before it was last reopened
    let lastReopened = issue.events.reverse().find(({ event }) => event === REOPENED);
    if (lastReopened) {
      issue.events = issue.events.slice(events.indexOf(lastReopened));
      issue.reviews = issues.reviews.filter(({ submitted_at }) => submitted_at > lastReopened.created_at);
    }

    issue.pull_request.opened_at = getOpenedForReviewDate(issue, lastReopened);
    issue.pull_request.first_reviewed_at = getFirstReviewedDate(issue);
    issue.tags = getTags(issue);

    if (issue.tags.includes(MERGED)) {
      issue.pull_request.time_to_merge = getTimeToMerge(issue);
      issue.pull_request.time_to_review = getTimeToReview(issue);
    }
  }

  return Object.values(issuesById);
}

/**
 * thanks to @bantic for the logic here!
 */
function getOpenedForReviewDate(issue, lastReopened) {
  let { events, pull_request } = issue;
  let { merged_at } = pull_request;

  let lastReadyForReview = events.reverse().find(({ event }) => event === READY_FOR_REVIEW);

  // if review was requested after merging, ignore
  let firstReviewRequested = events.find(({ event, created_at }) => event === REVIEW_REQUESTED && (!merged_at || merged_at > created_at));

  let openedForReview = lastReadyForReview || firstReviewRequested || lastReopened || pull_request
  return openedForReview.created_at;
}

function getFirstReviewedDate(issue) {
  let { reviews } = issue;
  return reviews[0]?.submitted_at;
}

function getTags(issue) {
  let { pull_request } = issue;
  let { opened_at, merged_at, draft } = pull_request;

  if (draft) {
    return [DRAFT];
  }

  let tags = [];
  if (opened_at < start) {
    tags.push(OLD);
  } else {
    tags.push(NEW);
  }

  if (merged_at) {
    tags.push(MERGED);
  } else {
    tags.push(OUTSTANDING);
  }
  return tags;
}

function getTimeToMerge(issue) {
  let { opened_at, merged_at } = issue.pull_request;
  return new Date(merged_at) - new Date(opened_at);
}

function getTimeToReview(issue) {
  let { opened_at, first_reviewed_at } = issue.pull_request;
  return new Date(first_reviewed_at) - new Date(opened_at);
}

async function runMetrics() {
  console.log('running metrics');

  function categorizeIssues(issues) {
    let categories = { [DRAFT]: [], [OLD]: [], [NEW]: [], [MERGED]: [], [OUTSTANDING]: []  };
    for (let issue of issues) {
      for (let tag of issue.tags) {
        categories[tag].push(issue);
      }
    }
    return categories;
  }

  let data = {};
  for (let repo of REPOS) {
    data[repo] = await fetchPRs(repo);
  }

  let metrics = {};

  // calculate individual metrics
  for (let username of teamMembers) {
    metrics[username] = { allRepos: {} };

    let categorized = {};
    for (let repo of REPOS) {
      categorized[repo] = categorizeIssues(data[repo][username]);
      console.log(`categorized - ${repo} - ${username}`, categorized[repo]);

      metrics[username][repo] = {};
      for (let key of TAGS) {
        let count = categorized[repo][key].length;
        metrics[username][repo][key] = count;
      }

      let totalTimeToMerge = 0;
      let totalTimeToReview = 0;
      let merged = categorized[repo][MERGED];
      for (let issue of merged) {
        let { time_to_merge, time_to_review } = issue.pull_request;
        totalTimeToMerge += time_to_merge;
        totalTimeToReview += time_to_review;
      }
      metrics[username][repo][TIME_TO_MERGE] = humanizeDuration(totalTimeToMerge / merged.length);
      metrics[username][repo][TIME_TO_REVIEW] = humanizeDuration(totalTimeToReview / merged.length);
    }
  }

  // calculate aggregate metrics
  let total = { allRepos: {} }
  for (let repo of REPOS) {
    total[repo] = {};
    for (let username of teamMembers) {
      for (let key of TAGS) {
        let count = metrics[username][repo][key];
        total[repo][key] = (total[repo][key] ?? 0) + count;
        total.allRepos[key] = (total.allRepos[key] ?? 0) + count;
        metrics[username].allRepos[key] = (metrics[username].allRepos[key] ?? 0) + count;
      }
    }
    // metrics.total[repo][TIME_TO_MERGE] = humanizeDuration(total[repo][TIME_TO_MERGE] / metrics.total[repo][MERGED]);
    // metrics.total[repo][TIME_TO_REVIEW] = humanizeDuration(total[repo][TIME_TO_REVIEW] / metrics.total[repo][MERGED]);
  }

  metrics.total = total;

  console.log(JSON.stringify(metrics, null, 2));
  console.log(metrics);
}

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
  let reviewPromises = {};
  let issuesByAuthor = {};

  // fetch issues for each user
  for (let username of teamMembers) {
    let openIssues = await openIssuesPromises[username];
    let mergedIssues = await mergedIssuesPromises[username];
    let allIssues = openIssues.concat(mergedIssues);
    issuesByAuthor[username] = allIssues;

    // fetch pr, events, and reviews for each issue
    for (let issue of allIssues) {
      let id = issue.number;
      issuesById[id] = issue;
      pullPromises[id] = http.GET(issue.pull_request.url);
      eventPromises[id] = http.GET(`${issuesUrl}/${id}/events`);
      reviewPromises[id] = http.GET(`${issue.pull_request.url}/reviews`);
    }
  }

  // enrich data
  for (let [id, issue] of Object.entries(issuesById)) {
    issue.repo = repo;
    issue.author = issue.user.login;
    issue.events = await eventPromises[id];
    issue.reviews = await reviewPromises[id];
    issue.pull_request = await pullPromises[id];

    // if it was ever closed, ignore events and reviews before it was last reopened
    let lastReopened = issue.events.reverse().find(({ event }) => event === REOPENED);
    if (lastReopened) {
      issue.events = issue.events.slice(events.indexOf(lastReopened));
      issue.reviews = issues.reviews.filter(({ submitted_at }) => submitted_at > lastReopened.created_at);
    }

    issue.pull_request.opened_at = getOpenedForReviewDate(issue, lastReopened);
    issue.pull_request.first_reviewed_at = getFirstReviewedDate(issue);
    issue.tags = getTags(issue);

    if (issue.tags.includes(MERGED)) {
      issue.pull_request.time_to_merge = getTimeToMerge(issue);
      issue.pull_request.time_to_review = getTimeToReview(issue);
    }
  }

  return issuesByAuthor;
}
