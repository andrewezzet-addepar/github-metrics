console.log('[github-metrics] chrome extension loaded');
const CONTAINER_ATTR = 'data-metrics-container';
const MODAL_ATTR = 'data-metrics-modal';
const AUTH_FORM_ATTR = 'data-metrics-auth-form';
const PARAMS_FORM_ATTR = 'data-metrics-params-form';
const TABLE_ATTR = 'data-metrics-table';

function addMetricsButton() {
  let anchor = document.querySelector('notification-indicator').parentElement;
  let button = document.createElement('button');
  button.style.marginRight = '48px';
  button.innerText = 'Metrics';
  anchor.insertAdjacentElement('beforebegin', button);
  button.onclick = async function() {
    openMetricsModal();
  }
}

addMetricsButton();

interface PullRequest {
  additions: number;
  deletions: number;
  time_to_merge: number;
  time_to_review: number;
  opened_at: string;
  merged_at: string;
  created_at: string;
  first_reviewed_at: string;
  draft: boolean;
}

interface User {
  login: string;
}

interface Event {
  event: string;
  created_at: string;
}

interface Issue {
  tags: string[];
  repo: string;
  author: string;
  user: User;
  reviews: {
    user: User;
    submitted_at: string;
  }[];
  pull_request: PullRequest;
  events: Event[];
}

class Metrics {
  issues: Issue[];

  constructor(issues: Issue[]) {
    this.issues = issues;
  }

  getIssues({ repo, author, tags, exclude = false }: { repo?: string; author?: string; tags?: string[], exclude?: boolean }): Issue[] {
    let issues = this.issues;
    if (repo) {
      issues = issues.filter(exclude ? issue => issue.repo !== repo : issue => issue.repo === repo);
    }

    if (author) {
      issues = issues.filter(exclude ? issue => issue.author !== author : issue => issue.author === author);
    }
    return issues;
  }

  getReviews({ author }): Issue[] {
    let startDate = config.getStartDate();
    let endDate = config.getEndDate();
    let issues = this.getIssues({ author, exclude: true });
    return issues.filter(issue => {
      return issue.reviews.some(review => {
        if (review.user.login !== author) {
          return false;
        }

        let reviewDate = new Date(review.submitted_at);
        return startDate < reviewDate && reviewDate < endDate;
      });
    });
  }

  getRepoMetrics(repo: string, { categorizeBy }: { categorizeBy: string; }): BundledMetrics {
    let issues = this.getIssues({ repo });
    return this.getMetrics(issues, { categorizeBy });
  }

  getUserMetrics(author: string, { categorizeBy }: { categorizeBy: string; }): BundledMetrics {
    let issues = this.getIssues({ author });
    let reviews = this.getReviews({ author });
    return this.getMetrics(issues, { reviews, categorizeBy });
  }

  getMetrics(issues: Issue[], { reviews, categorizeBy }: { categorizeBy: string; reviews?: Issue[]; }): BundledMetrics {
    let metrics = {
      counts: this.getCounts(issues, { reviews, categorizeBy }),
      timings: this.getTimings(issues, { reviews, categorizeBy }),
    };
    return metrics;
  }

  getCounts(issues: Issue[], { reviews = [], categorizeBy }: { reviews: Issue[]; categorizeBy: any; }): { all: CountMetrics; [key: string]: CountMetrics } {
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
    for (let issue of reviews) {
      if (categorizeBy) {
        let category = issue[categorizeBy];
        if (!counts[category]) {
          counts[category] = new CountMetrics();
        }
        counts[category].addReview(issue);
      }
      counts.all.addReview(issue);
    }
    return counts;
  }

  getTimings(issues: Issue[], { reviews, categorizeBy }: { reviews: Issue[]; categorizeBy: any; }): { all: TimingMetrics; [key: string]: TimingMetrics } {
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

function parseCommaSeparated(value: string): string[] {
  if (!value.trim().length) {
    return [];
  }
  return value.split(',').map(val => val.trim()).filter(val => val.length);
}

class Config {
  getform(dataAttr: string) {
    return document.querySelector(`[${dataAttr}]`) as HTMLFormElement;
  }

  getValue(formAttr: string, field: string) {
    return this.getform(formAttr).elements[field].value;
  }

  get username() {
    return this.defaults.username;
  }

  get token() {
    return this.defaults.token;
  }

  get start() {
    return this.getValue(PARAMS_FORM_ATTR, 'start');
  }

  getStartDate() {
    return new Date(this.start);
  }

  get end() {
    return this.getValue(PARAMS_FORM_ATTR, 'end');
  }

  getEndDate() {
    return new Date(this.end);
  }

  get repos() {
    let value = this.getValue(PARAMS_FORM_ATTR, 'repos');
    return parseCommaSeparated(value);
  }

  get usernames() {
    let value = this.getValue(PARAMS_FORM_ATTR, 'usernames');
    return parseCommaSeparated(value);
  }

  get initStartDate() {
    let date = new Date();
    date.setDate(this.initEndDate.getDate() - 14);
    return date;
  }

  get initEndDate() {
    return new Date();
  }
  
  get defaults() {
    return {
      username: 'andrewezzet-addepar',
      token: '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',
      start: this.initStartDate.toISOString(),
      end: this.initEndDate.toISOString(),
      repos: ['AMP', 'Iverson'],
      usernames: [
        'tweseley',
        'andrewezzet-addepar',
        'laurenpitruz',
        'kyle-simmons',
        'javoltaire',
      ],
    }
  }
}

let config = new Config();

type GroupedMetrics<T> = {
  all: T;
  [key: string]: T;
}

type GroupedCountMetrics = GroupedMetrics<CountMetrics>;
type GroupedTimingMetrics = GroupedMetrics<TimingMetrics>;

interface BundledMetrics {
  counts: GroupedCountMetrics;
  timings: GroupedTimingMetrics;
}

type GroupedBundledMetrics = GroupedMetrics<BundledMetrics>;

async function runMetrics() {
  console.log('running metrics');

  let { repos, usernames } = config;

  if (!repos.length || !usernames.length) {
    renderMetrics();
    return;
  }

  let data: Issue[] = [];
  for (let repo of repos) {
    data = data.concat(await fetchPRs(repo, usernames));
  }

  console.log(data);

  let metrics = new Metrics(data);

  let resultsByRepo: GroupedBundledMetrics = { all: null };
  for (let repo of repos) {
    resultsByRepo[repo] = metrics.getRepoMetrics(repo, { categorizeBy: 'author' });
  }
  resultsByRepo.all = aggregateMetrics(resultsByRepo);

  let resultsByAuthor: GroupedBundledMetrics = { all: null };
  for (let username of usernames) {
    resultsByAuthor[username] = metrics.getUserMetrics(username, { categorizeBy: 'repo' });
  }
  resultsByAuthor.all = aggregateMetrics(resultsByAuthor);

  console.log(resultsByRepo, resultsByAuthor);
  renderMetrics(
    { title: 'Results by Repo', metrics: resultsByRepo }, 
    { title: 'Results by Author', metrics: resultsByAuthor },
  );
}

function aggregateMetrics(metrics: GroupedBundledMetrics): BundledMetrics {
  let total = { counts: new CountMetrics(), timings: new TimingMetrics() };
  for (let category of Object.keys(metrics)) {
    let { counts, timings } = metrics[category];
    total.counts.addCounts(counts.all);
    total.timings.addTimings(timings.all);
  }
  return { counts: { all: total.counts }, timings: { all: total.timings } };
}

function openMetricsModal() {
  let modal = renderModal();
  addParamsForm(modal);
}

// function addAuthForm(parent) {
//   let formContainer = document.createElement('div');
//   formContainer.innerHTML = `
//     <form style="margin-top: 8px" ${AUTH_FORM_ATTR}>
//       <label for="username">Username</label>
//       <input id="user" name="user">
//       <label for="token" style="margin-left: 16px;">Token</label>
//       <input id="token" name="token">
//     </form>
//   `;
//   parent.appendChild(formContainer);
// }

function addParamsForm(parent: HTMLDivElement) {
  let formContainer = document.createElement('div');
  formContainer.innerHTML = `
    <style>
      .form-group {
        margin-bottom: 16px;
      }
      input {
        margin-right: 8px;
      }
    </style>
    <form style="margin-top: 8px" ${PARAMS_FORM_ATTR}>
      <div class="form-group">
        <label for="start">Start</label>
        <input type="date" id="start" name="start">
        <label for="end">End</label>
        <input type="date" id="end" name="end">
      </div>
      <div class="form-group">
        <label for="repos">Repos</label>
        <input id="repos" name="repos">
        <label for="usernames">Usernames</label>
        <input style="width: 500px;" id="usernames" name="usernames">
      </div>
    </form>
  `;
  let button = document.createElement('button');
  button.style.marginLeft = '8px';
  button.type = 'button';
  button.innerText = 'Run';
  button.onclick = async function() {
    button.disabled = true;
    button.innerText = 'Loading...';
    await runMetrics();
    button.disabled = false;
    button.innerText = 'Run';
  }
  let form = formContainer.querySelector('form');
  form.elements['start'].value = toDateInputFormat(new Date(config.defaults.start));
  form.elements['end'].value = toDateInputFormat(new Date(config.defaults.end));
  form.elements['repos'].value = config.defaults.repos;
  form.elements['usernames'].value = config.defaults.usernames;
  form.lastElementChild.appendChild(button);
  parent.appendChild(formContainer);
}

function toDateInputFormat(date: Date): string {
  let m = date.getMonth() + 1;
  let d = date.getDate();
  let y = date.getFullYear();
  return `${y}-${(m < 10 ? '0' : '') + m}-${(d < 10 ? '0' : '') + d}`;
}

function ModalContainer(): HTMLDivElement {
  let container: HTMLDivElement = document.querySelector(`[${CONTAINER_ATTR}]`);
  if (!container) {
    container = document.createElement('div');
    container.setAttribute(CONTAINER_ATTR, 'true');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.background = '#00000033';
    document.querySelector('body').appendChild(container);
  }
  return container;
}

function renderMetrics(...titledMetrics: { title: string; metrics: GroupedBundledMetrics; }[]) {
  let modal = renderModal();

  let prevTables = document.querySelectorAll(`[${TABLE_ATTR}]`);
  for (let table of prevTables) {
    modal.removeChild(table);
  }

  for (let { title, metrics } of titledMetrics) {
    modal.appendChild(MetricsTable(title, metrics));
  }
}

function renderModal(): HTMLDivElement {
  let container = ModalContainer();
  let modal = Modal(container);
  return modal;
}

function Modal(container: HTMLDivElement, title = 'Metrics'): HTMLDivElement {
  let modal: HTMLDivElement = document.querySelector(`[${MODAL_ATTR}]`);
  if (!modal) {
    modal = document.createElement('div');
    modal.setAttribute(MODAL_ATTR, 'true');
    modal.style.background = 'white';
    modal.style.borderRadius = '8px';
    modal.style.padding = '8px 16px 16px';
    modal.style.boxShadow = '5px 5px 10px 0px gray';
  
    modal.innerHTML = ModalHeader(title);
    container.appendChild(modal);
  }

  return modal;
}

function ModalHeader(title: string): string {
  return `<h3>${title}</h3>`;
}

function MetricsTable(title: string, metrics: GroupedBundledMetrics): HTMLDivElement {
  let tableDiv = document.createElement('div');
  tableDiv.setAttribute(TABLE_ATTR, 'true');
  tableDiv.style.marginTop = '24px';

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
        ${TableHeaderRow([...TAGS, ...TIMINGS, REVIEWS])}
      </thead>
      <tbody>
        ${Object.entries(metrics).map(renderGroup).join('')}
      </tbody>
    </table>
  `;
  return tableDiv;
}

function formatDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

function Header(title: string): string {
  let startDate = config.getStartDate();
  let endDate = config.getEndDate();
  return `
    <h4 style="margin-bottom: 8px">
      ${title} (${formatDate(startDate)} to ${formatDate(endDate)})
    </h4>
  `;
}

function TableHeaderRow(columns: string[]): string {
  return `
    <tr>
      <th></th>
      ${columns.map(HeaderCell).join('')}
    </tr>
  `;
}

function HeaderCell(headerName: string): string {
  return `<th>${headerName}</th>`;
}

function TableCell(value: string | number): string {
  return `<td>${value}</td>`;
}

function renderGroup([category, metrics]: [string, BundledMetrics]): string {
  let { counts, timings } = metrics;
  return `
    <tr>
      ${HeaderCell(category)}
      ${renderCounts(counts.all)}
      ${renderTimings(timings.all)}
      ${renderReviews(counts.all.reviews)}
    </tr>
  `;
}

function renderCounts(counts: CountMetrics): string {
  return TAGS.map(tag => TableCell(counts[tag])).join('');
}

function renderTimings(timings: TimingMetrics): string {
  let { entries, summary } = timings;
  let { additions, deletions } = summary;
  let avgAdd = additions / entries.length;
  let avgDel = deletions / entries.length;
  return `
    ${TableCell(humanizeDuration(timings.avgTimeToMerge) ?? 'N/A')}
    ${TableCell(humanizeDuration(timings.avgTimeToReview) ?? 'N/A')}
    ${TableCell(diffSummary(avgAdd, avgDel) ??  'N/A')}
  `;
}

function renderReviews(reviewCount: number): string {
  if (typeof reviewCount !== 'number') {
    return '';
  }

  return TableCell(reviewCount);
}

function diffSummary(add: number, del: number): string {
  if (isNaN(add) || isNaN(del)) {
    return null;
  }
  return `${toFixed(0, add + del)}&nbsp;(+${toFixed(0, add)}/-${toFixed(0, del)})`;
}

class CountMetrics {
  draft: number;
  old: number;
  new: number;
  merged: number;
  outstanding: number;
  reviews: number;

  constructor() {
    this.draft = 0;
    this.old = 0;
    this.new = 0;
    this.merged = 0;
    this.outstanding = 0;
    this.reviews = 0;
  }

  addCounts(counts: CountMetrics) {
    this.draft += counts.draft;
    this.old += counts.old;
    this.new += counts.new;
    this.merged += counts.merged;
    this.outstanding += counts.outstanding;
    this.reviews += counts.reviews;
  }

  addIssue(issue: Issue) {
    for (let tag of issue.tags) {
      this[tag] += 1;
    }
  }

  addReview(_issue: Issue) {
    this.reviews += 1;
  }
}

class TimingMetrics {
  entries: PullRequest[];

  constructor() {
    this.entries = [];
  }

  addTimings(timings: { entries: PullRequest[] }) {
    this.entries = this.entries.concat(timings.entries);
  }

  addIssue(issue: Issue) {
    if (issue.tags.includes(MERGED)) {
      this.entries.push(issue.pull_request);
    }
  }

  get totalTimeToMerge() {
    return this.entries.reduce((acc, entry) => acc + entry.time_to_merge, 0);
  }

  get totalTimeToReview() {
    return this.entries.reduce((acc, entry) => acc + entry.time_to_review, 0);
  }

  get avgTimeToMerge() {
    return this.totalTimeToMerge / this.entries.length;
  }

  get avgTimeToReview() {
    return this.totalTimeToReview / this.entries.length;
  }

  get summary() {
    return this.entries.reduce((acc, entry) => {
      let total = entry.additions + entry.deletions;
      acc.totalDiff += total;
      acc.additions += entry.additions;
      acc.deletions += entry.deletions;
      if (!acc.minDiff || acc.minDiff > total) {
        acc.minDiff = total;
      }
      if (!acc.maxDiff || acc.maxDiff < total) {
        acc.maxDiff = total;
      }

      let minTime = Math.min(entry.time_to_merge, entry.time_to_review);
      let maxTime = Math.max(entry.time_to_merge, entry.time_to_review);
      if (!acc.minTime || acc.minTime > minTime) {
        acc.minTime = minTime;
      }
      if (!acc.maxTime || acc.maxTime < maxTime) {
        acc.maxTime = maxTime;
      }
      return acc;
    }, { 
      totalDiff: 0, 
      additions: 0, 
      deletions: 0, 
      minDiff: null, 
      maxDiff: null,
      minTime: null,
      maxTime: null,
    });
  }
}

function humanizeDuration(millis: number): string {
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

  return `${toFixed(1, value)} ${unit}`;
}

function toFixed(maxDecimals: number, value: number): string {
  let charsAfterDecimal = value.toString().split('.')[1];
  let decimals = charsAfterDecimal ? Math.max(0, charsAfterDecimal.length) : 0;
  return value.toFixed(Math.min(decimals, maxDecimals));
}

const REVIEWS = 'reviews';

const DRAFT = 'draft';
const OLD = 'old';
const NEW = 'new';
const MERGED = 'merged';
const OUTSTANDING = 'outstanding';
const TAGS = [/*DRAFT, */OLD, NEW, MERGED, OUTSTANDING];

const ADDITIONS = 'additions';
const DELETIONS = 'deletions';
const DIFF = 'avg_diff';
const TIME_TO_MERGE = 'time_to_merge';
const TIME_TO_REVIEW = 'time_to_review';
const TIMINGS = [TIME_TO_MERGE, TIME_TO_REVIEW, DIFF];

const REOPENED = 'reopened';
const READY_FOR_REVIEW = 'ready_for_review';
const REVIEW_REQUESTED = 'review_requested';

class HttpClient {
  options: { headers: Headers };

  constructor(username: string, token: string) {
    this.options = { 
      headers: new Headers({ 
        'Authorization': 'Basic ' + btoa(`${username}:${token}`),
        'Accept': 'application/vnd.github.v3+json',
      }),
    };
  }

  async GET(url: string): Promise<any> {
    return fetch(url, this.options).then(res => res.json())
  }
}

let http: HttpClient;

async function fetchPRs(repo: string, usernames: string[]): Promise<Issue[]> {
  console.log(`fetching data - repo: ${repo} - usernames: ${usernames}`);

  if (!http) {
    let { username, token } = config;
    http = new HttpClient(username, token);
  }

  const issuesUrl = `https://api.github.com/repos/addepar/${repo}/issues`;

  let openIssuesPromises = {};
  let mergedIssuesPromises = {};
  for (let username of usernames) {
    openIssuesPromises[username] = http.GET(`${issuesUrl}?creator=${username}&pulls=true&state=open`);
    mergedIssuesPromises[username] = http.GET(`${issuesUrl}?creator=${username}&pulls=true&state=closed&since=${config.start}`);
  }

  let issuesById: { [id: string]: Issue } = {};
  let pullPromises = {};
  let eventPromises = {};
  let reviewPromises = {};

  // fetch issues for each user
  for (let username of usernames) {
    let openIssues = await openIssuesPromises[username];
    let mergedIssues = await mergedIssuesPromises[username];

    // these API's don't currently support adding an end date
    mergedIssues = mergedIssues.filter(({ closed_at }) => closed_at < config.end);

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
      issue.events = issue.events.slice(issue.events.indexOf(lastReopened));
      issue.reviews = issue.reviews.filter(({ submitted_at }) => submitted_at > lastReopened.created_at);
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
function getOpenedForReviewDate(issue: Issue, lastReopened: Event): string {
  let { events, pull_request } = issue;
  let { merged_at } = pull_request;

  let lastReadyForReview = events.reverse().find(({ event }) => event === READY_FOR_REVIEW);

  // if review was requested after merging, ignore
  let firstReviewRequested = events.find(({ event, created_at }) => event === REVIEW_REQUESTED && (!merged_at || merged_at > created_at));

  let openedForReview = lastReadyForReview || firstReviewRequested || lastReopened || pull_request
  return openedForReview.created_at;
}

function getFirstReviewedDate(issue: Issue): string {
  let { reviews, pull_request } = issue;
  let { opened_at } = pull_request;
  let firstReviewSinceOpenedForReview = reviews.find(({ submitted_at }) => submitted_at > opened_at);
  return firstReviewSinceOpenedForReview?.submitted_at;
}

function getTags(issue: Issue): string[] {
  let { pull_request } = issue;
  let { opened_at, merged_at, draft } = pull_request;

  if (draft) {
    return [DRAFT];
  }

  return [
    opened_at < config.start ? OLD : NEW,
    merged_at ? MERGED : OUTSTANDING
  ];
}

function getTimeToMerge(issue: Issue): number {
  let { opened_at, merged_at } = issue.pull_request;
  return new Date(merged_at).valueOf() - new Date(opened_at).valueOf();
}

// if it was only ever reviewed _before_ it was 'opened for review', 
// `first_reviewed_at` will be null, and `time_to_review` will be 0
function getTimeToReview(issue: Issue): number {
  let { opened_at, first_reviewed_at } = issue.pull_request;
  return new Date(first_reviewed_at ?? opened_at).valueOf() - new Date(opened_at).valueOf();
}
