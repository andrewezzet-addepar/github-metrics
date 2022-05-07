import config from './config';
import { renderMetrics } from './rendering';
import { DRAFT, MERGED, NEW, OLD, OPEN } from './constants';

export const REOPENED = 'reopened';
export const READY_FOR_REVIEW = 'ready_for_review';
export const REVIEW_REQUESTED = 'review_requested';

interface PullRequest {
  url: string;
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
  closed_at: string;
  number: string;
}

interface Review {
  id: string;
  repo: string;
  author: string;
  isTeamReview: boolean;
}

class Metrics {
  issues: Issue[];
  reviews: Review[];

  constructor(issues: Issue[], reviews: Review[]) {
    this.issues = issues;
    this.reviews = reviews;
  }

  getIssues({ repo, author }: { repo?: string; author?: string; } = {}): Issue[] {
    let issues = this.issues;
    if (repo) {
      issues = issues.filter(issue => issue.repo === repo);
    }

    if (author) {
      issues = issues.filter(issue => issue.author === author);
    }
    return issues;
  }

  getReviews({ repo, author }: { repo?: string; author?: string; } = {}): Review[] {
    let reviews = this.reviews;
    if (repo) {
      reviews = reviews.filter(review => review.repo === repo);
    }

    if (author) {
      reviews = reviews.filter(review => review.author === author);
    }
    return reviews;
  }

  getRepoMetrics(repo: string, { categorizeBy }: { categorizeBy?: string; }): BundledMetrics {
    let issues = this.getIssues({ repo });
    let reviews = this.getReviews({ repo });
    return this.getMetrics(issues, reviews, { categorizeBy });
  }

  getUserMetrics(author: string, { categorizeBy }: { categorizeBy?: string; }): BundledMetrics {
    let issues = this.getIssues({ author });
    let reviews = this.getReviews({ author });
    return this.getMetrics(issues, reviews, { categorizeBy });
  }

  getMetrics(issues: Issue[], reviews: Review[], { categorizeBy }: { categorizeBy?: string; }): BundledMetrics {
    let metrics = {
      counts: this.getCounts(issues, reviews, { categorizeBy }),
      timings: this.getTimings(issues, { categorizeBy }),
    };
    return metrics;
  }

  getCounts(issues: Issue[], reviews: Review[], { categorizeBy }: { categorizeBy?: string; }): { all: CountMetrics;[key: string]: CountMetrics; } {
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

  getTimings(issues: Issue[], { categorizeBy }: { categorizeBy?: string }): { all: TimingMetrics;[key: string]: TimingMetrics; } {
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

type GroupedMetrics<T> = {
  all?: T;
  [key: string]: T;
};
type GroupedCountMetrics = GroupedMetrics<CountMetrics>;
type GroupedTimingMetrics = GroupedMetrics<TimingMetrics>;

export interface BundledMetrics {
  counts: GroupedCountMetrics;
  timings: GroupedTimingMetrics;
}

export type GroupedBundledMetrics = GroupedMetrics<BundledMetrics>;

export async function runMetrics() {
  console.log('running metrics');

  let { repos, usernames } = config;

  if (!repos.length || !usernames.length) {
    renderMetrics();
    return;
  }

  let pulls: Issue[] = [];
  for (let repo of repos) {
    pulls = pulls.concat(await fetchPRs(repo, usernames));
  }

  let reviews = await fetchReviews(usernames);

  console.log(pulls);
  console.log(reviews);

  let metrics = new Metrics(pulls, reviews);

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
    { title: 'Metrics by Repo', metrics: resultsByRepo },
    { title: 'Metrics by Author', metrics: resultsByAuthor }
  );
}

function aggregateMetrics(metrics: GroupedBundledMetrics): BundledMetrics {
  let total = { counts: new CountMetrics(), timings: new TimingMetrics() };
  for (let category of Object.keys(metrics).filter(key => key !== 'all')) {
    let { counts, timings } = metrics[category];
    total.counts.addCounts(counts.all);
    total.timings.addTimings(timings.all);
  }
  return { counts: { all: total.counts }, timings: { all: total.timings } };
}

export class CountMetrics {
  draft: number = 0;
  old: number = 0;
  new: number = 0;
  merged: number = 0;
  open: number = 0;
  teamReviewCount: number = 0;
  otherReviewCount: number = 0;

  addCounts(counts: CountMetrics) {
    this.draft += counts.draft;
    this.old += counts.old;
    this.new += counts.new;
    this.merged += counts.merged;
    this.open += counts.open;
    this.teamReviewCount += counts.teamReviewCount;
    this.otherReviewCount += counts.otherReviewCount;
  }

  addIssue(issue: Issue) {
    for (let tag of issue.tags) {
      this[tag] += 1;
    }
  }

  addReview(review: Review) {
    if (review.isTeamReview) {
      this.teamReviewCount++;
    } else {
      this.otherReviewCount += 1;
    }
  }

  get totalReviewCount() {
    return this.teamReviewCount + this.otherReviewCount;
  }
}

export class TimingMetrics {
  entries: PullRequest[];

  constructor() {
    this.entries = [];
  }

  addTimings(timings: { entries: PullRequest[]; }) {
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

class HttpClient {
  options: { headers: Headers; };

  constructor(username: string, token: string) {
    this.options = {
      headers: new Headers({
        'Authorization': 'Basic ' + btoa(`${username}:${token}`),
        'Accept': 'application/vnd.github.v3+json',
      }),
    };
  }
  
  get queryOptions() {
    return { ...this.options, method: 'post' };
  }

  async GET(url: string): Promise<object> {
    return fetch(url, this.options).then(res => res.json());
  }

  async QUERY(url: string, query: string): Promise<object> {
    return fetch(url, { ...this.queryOptions, body: JSON.stringify({ query }) }).then(res => res.json());
  }
}

let http: HttpClient;

async function fetchReviews(usernames: string[]): Promise<Review[]> {
  console.log(`fetching reviews - usernames: ${usernames}`);

  let { username, token } = config;
  http = new HttpClient(username, token);

  const reviewsUrl = 'https://api.github.com/graphql';

  let reviewsPromises = {};
  for (let username of usernames) {
    reviewsPromises[username] = http.QUERY(reviewsUrl, `{
      user(login: "${username}") {
        login
        contributionsCollection(
          from: "${config.startDate.toISOString()}",
          to: "${config.endDate.toISOString()}"
        ) {
          pullRequestReviewContributions(first: 100) {
            nodes {
              pullRequest {
                author {
                  login
                }
                repository {
                  name
                }
                id
              }
            }
          }
        }
      }
    }`);
  }

  let result: Review[] = [];
  for (let username of usernames) {
    let { data } = await reviewsPromises[username];
    let pullRequestsById: { [id: string]: Review } = {};
    for (let node of data.user.contributionsCollection.pullRequestReviewContributions.nodes) {
      let { id, author, repository } = node.pullRequest;
      if (author.login === username || pullRequestsById[id]) {
        continue;
      }

      pullRequestsById[id] = {
        id,
        repo: repository.name,
        author: username,
        isTeamReview: usernames.includes(author.login),
      };
    }
    result.push(...Object.values(pullRequestsById));
  }

  return result;
}

async function fetchPRs(repo: string, usernames: string[]): Promise<Issue[]> {
  console.log(`fetching pull requests - repo: ${repo} - usernames: ${usernames}`);

  let { username, token } = config;
  http = new HttpClient(username, token);

  const issuesUrl = `https://api.github.com/repos/addepar/${repo}/issues`;

  let limit = 100;
  async function getIssues(queryParams: string, page: number = 1): Promise<Issue[]> {
    let result = await http.GET(`${issuesUrl}?per_page=${limit}&page=${page}&pulls=true&${queryParams}`) as Issue[];
    if (result.length === limit) {
      result = result.concat(await getIssues(queryParams, ++page));
    }
    return result;
  }

  let openIssuesPromises = {};
  let mergedIssuesPromises = {};
  for (let username of usernames) {
    openIssuesPromises[username] = getIssues(`creator=${username}&state=open`);
    mergedIssuesPromises[username] = getIssues(`creator=${username}&state=closed&since=${config.start}`);
  }

  let issuesById: { [id: string]: Issue; } = {};
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

  let openedForReview = lastReadyForReview || firstReviewRequested || lastReopened || pull_request;
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
    merged_at ? MERGED : OPEN
  ];
}

function getTimeToMerge(issue: Issue): number {
  let { opened_at, merged_at } = issue.pull_request;
  return new Date(merged_at).valueOf() - new Date(opened_at).valueOf();
}

function getTimeToReview(issue: Issue): number {
  // if it was only ever reviewed _before_ it was 'opened for review', 
  // `first_reviewed_at` will be null, and `time_to_review` will be 0
  let { opened_at, first_reviewed_at } = issue.pull_request;
  return new Date(first_reviewed_at ?? opened_at).valueOf() - new Date(opened_at).valueOf();
}
