import Config from './config';
import { PARAMS_FORM_ATTR, CONTAINER_ATTR, TABLE_ATTR, MODAL_ATTR, REVIEWS, TAGS, TIMINGS } from './constants';
import { runMetrics, GroupedBundledMetrics, BundledMetrics, CountMetrics, TimingMetrics } from './content_script';

export function addMetricsButton(config: Config) {
  let anchor = document.querySelector('notification-indicator').parentElement;
  let button = document.createElement('button');
  button.style.marginRight = '48px';
  button.innerText = 'Metrics';
  anchor.insertAdjacentElement('beforebegin', button);
  button.onclick = () => openMetricsModal(config);
}

function openMetricsModal(config: Config) {
  let modal = renderModal();
  addParamsForm(modal, config);
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

function addParamsForm(parent: HTMLDivElement, config: Config) {
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
  button.onclick = async function () {
    button.disabled = true;
    button.innerText = 'Loading...';
    await runMetrics();
    button.disabled = false;
    button.innerText = 'Run';
  };
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
export function renderMetrics(config: Config, ...titledMetrics: { title: string; metrics: GroupedBundledMetrics; }[]) {
  let modal = renderModal();

  let prevTables = document.querySelectorAll(`[${TABLE_ATTR}]`);
  for (let table of prevTables) {
    modal.removeChild(table);
  }

  for (let { title, metrics } of titledMetrics) {
    modal.appendChild(MetricsTable(title, metrics, config));
  }
}
function renderModal(): HTMLDivElement {
  let container = ModalContainer();
  return Modal(container);
}
function Modal(container: HTMLDivElement, title = 'Metrics'): HTMLDivElement {
  let modal: HTMLDivElement = container.querySelector(`[${MODAL_ATTR}]`);
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
function MetricsTable(title: string, metrics: GroupedBundledMetrics, config: Config): HTMLDivElement {
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
    ${Header(title, config)}
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
function Header(title: string, config: Config): string {
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
    ${TableCell(diffSummary(avgAdd, avgDel) ?? 'N/A')}
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
      return [hours, 'hours'];
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
