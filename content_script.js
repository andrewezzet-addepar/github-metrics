console.log('[github-metrics] chrome extension loaded');
const LINK_ATTR = 'data-chrome-extension-linked';
const TESTS_SELECTOR = `#qunit-tests > li > strong:not([${LINK_ATTR}])`;
const PASSED_TESTS_SELECTOR = `#qunit-tests > li.pass > strong[${LINK_ATTR}]`;

const teamMembers = [
  // 'twesely',
  // 'aberman-addepar',
  'addemike',
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

let AMP = 'AMP';
let IVERSON = 'Iverson';
let REPOS = [AMP, IVERSON];

async function runMetrics() {
  console.log('running metrics');

  let data = {};
  for (let repo of REPOS) {
    data[repo] = await fetchPRs(repo);
  }

  let metrics = {};

  // calculate individual metrics
  for (let username of teamMembers) {
    metrics[username] = { total: {} };

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
        let { opened_at, merged_at, first_reviewed_at } = issue.pull_request;

        let timeToMerge = new Date(merged_at) - new Date(opened_at);
        totalTimeToMerge += timeToMerge;

        let timeToReview = new Date(first_reviewed_at) - new Date(opened_at);
        totalTimeToReview += timeToReview;
      }
      metrics[username][repo][TIME_TO_MERGE] = humanizeDuration(totalTimeToMerge / merged.length);
      metrics[username][repo][TIME_TO_REVIEW] = humanizeDuration(totalTimeToReview / merged.length);
    }
  }

  // calculate aggregate metrics
  let total = { total: {} }
  for (let repo of REPOS) {
    total[repo] = {};
    for (let username of teamMembers) {
      for (let key of TAGS) {
        let count = metrics[username][repo][key];
        total[repo][key] = (total[repo][key] ?? 0) + count;
        total.total[key] = (total.total[key] ?? 0) + count;
        metrics[username].total[key] = (metrics[username].total[key] ?? 0) + count;
      }
    }
    // metrics.total[repo][TIME_TO_MERGE] = humanizeDuration(total[repo][TIME_TO_MERGE] / metrics.total[repo][MERGED]);
    // metrics.total[repo][TIME_TO_REVIEW] = humanizeDuration(total[repo][TIME_TO_REVIEW] / metrics.total[repo][MERGED]);
  }

  metrics.total = total;

  console.log(JSON.stringify(metrics, null, 2));
  console.log(metrics);
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

  let charsAfterDecimal = value.toString().split('.')[1];
  let decimals = charsAfterDecimal ? Math.max(0, charsAfterDecimal.length) : 0;
  return `${value.toFixed(Math.min(decimals, 2))} ${unit}`;
}

const DRAFT = 'draft';
const OLD = 'old';
const NEW = 'new';
const MERGED = 'merged';
const OUTSTANDING = 'outstanding';
const TAGS = [DRAFT, OLD, NEW, MERGED, OUTSTANDING];

const TIME_TO_MERGE = 'time_to_merge';
const TIME_TO_REVIEW = 'time_to_review';

const REOPENED = 'reopened';
const READY_FOR_REVIEW = 'ready_for_review';
const REVIEW_REQUESTED = 'review_requested';

function categorizeIssues(issues) {
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

  let categories = { [DRAFT]: [], [OLD]: [], [NEW]: [], [MERGED]: [], [OUTSTANDING]: []  };
  for (let issue of issues) {
    let tags = getTags(issue);
    for (let tag of tags) {
      categories[tag].push(issue);
    }
  }
  return categories;
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
    return fetch(url, this.options).then(res => res.json())
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
  }

  return issuesByAuthor;
}

function getFirstReviewedDate(issue) {
  let { reviews } = issue;
  return reviews[0]?.submitted_at;
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
