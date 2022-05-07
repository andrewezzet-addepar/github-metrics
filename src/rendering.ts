import config, { FIELD_NAMES, STORED_FIELD_NAMES } from './config';
import { TAGS, TIMINGS, REVIEWS } from './constants';
import { diffSummary, formatDate, humanizeDuration } from './utils';
import { runMetrics, GroupedBundledMetrics, CountMetrics, TimingMetrics } from "./metrics";

export const ESCAPE_KEY_EVENT = 'keyup';

export const CONTAINER_ATTR = 'data-metrics-container';
export const MODAL_ATTR = 'data-metrics-modal';
export const MODAL_CLOSE_ATTR = 'data-close';
export const PARAMS_FORM_ATTR = 'data-metrics-params-form';
export const TABLE_ATTR = 'data-metrics-table';

export default function render() {
  addMetricsButton();
}

function addMetricsButton() {
  let anchor = document.querySelector('notification-indicator').parentElement;
  let div = document.createElement('div');
  div.innerHTML = `
    <style>
      .metrics-button {
        margin-right: 48px;
        border-radius: 4px;
        padding: 2px 10px;
        background: white;
        font-weight: 500;
        color: var(--color-fg-default);
        border: 1px solid var(--color-border-default);
      }

      .metrics-button:hover {
        opacity: 0.95;
        background: var(--color-canvas-subtle);
      }
    
    </style>
    <button class="metrics-button">Metrics</button>
  `;
  let button = div.querySelector('button');
  button.onclick = openMetricsModal;
  anchor.insertAdjacentElement('beforebegin', div);
}

export function renderMetrics(...titledMetrics: { title: string; metrics: GroupedBundledMetrics; }[]) {
  let prevTables = document.querySelectorAll(`[${TABLE_ATTR}]`);
  for (let table of prevTables) {
    table.remove();
  }

  let modal = Modal();
  for (let { title, metrics } of titledMetrics) {
    modal.appendChild(MetricsTable(title, metrics));
  }
}

function escapeKeyHandler(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMetricsModal();
  }
}

function closeMetricsModal() {
  let container = ModalContainer();
  container.remove();
  document.removeEventListener(ESCAPE_KEY_EVENT, escapeKeyHandler);
}

async function openMetricsModal() {
  document.addEventListener(ESCAPE_KEY_EVENT, escapeKeyHandler);

  let modal = Modal();
  if (modal.querySelector(`[${PARAMS_FORM_ATTR}]`)) {
    return;
  }

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
        <label for="username">User</label>
        <input id="username" name="username">
        <label for="token">Token</label>
        <input type="password" id="token" name="token">
        <label for="remember">Remember</label>
        <input type="checkbox" id="remember" name="remember">
      </div>
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
  for (let field of Object.keys(FIELD_NAMES)) {
    let input = form.elements[field];
    input.value = config.initField(field);
  }

  for (let field of Object.keys(STORED_FIELD_NAMES)) {
    let input = form.elements[field] as HTMLInputElement;
    let initialValue = await config.initStoredField(field);
    if (input.type === 'checkbox') {
      input.checked = initialValue;
      input.onclick = storedValueChanged;
    } else {
      input.value = initialValue;
      input.oninput = storedValueChanged;
    }
  }

  form.lastElementChild.appendChild(button);
  modal.appendChild(formContainer);
}

function storedValueChanged(event: PointerEvent) {
  let input = event.target as HTMLInputElement;
  config.storedValueChanged(input);
}

function ModalContainer(): HTMLDivElement {
  let container = document.querySelector(`[${CONTAINER_ATTR}]`) as HTMLDivElement;
  if (!container) {
    container = document.createElement('div');
    container.setAttribute(CONTAINER_ATTR, 'true');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.background = '#00000033';
    container.style.zIndex = '1000';
    document.querySelector('body').appendChild(container);
  }
  return container;
}

function Modal(title = 'PR Metrics'): HTMLDivElement {
  let container = ModalContainer();
  let modal = container.querySelector(`[${MODAL_ATTR}]`) as HTMLDivElement;
  if (!modal) {
    modal = document.createElement('div');
    modal.setAttribute(MODAL_ATTR, 'true');
    modal.style.background = 'white';
    modal.style.borderRadius = '8px';
    modal.style.padding = '8px 16px 16px';
    modal.style.boxShadow = '5px 5px 10px 0px gray';

    modal.innerHTML = `
      <style>
        button.close {
          width: 24px;
          height: 24px;
          line-height: 16px;
          display: flex;
          position: relative;
          top: 6px;
        }
      </style>
      <div style="display: flex; flex-direction: row; justify-content: space-between">
        <h3>${title}</h3>
        <button ${MODAL_CLOSE_ATTR} class="close">
          x
        </button>
      </div>
    `;
    let closeButton = modal.querySelector(`[${MODAL_CLOSE_ATTR}]`) as HTMLButtonElement;
    closeButton.onclick = closeMetricsModal;
    container.appendChild(modal);
  }

  return modal;
}

function MetricsTable(title: string, groupedMetrics: GroupedBundledMetrics): HTMLDivElement {
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
    <h4 style="margin-bottom: 8px">
      ${title} (${formatDate(config.startDate)} to ${formatDate(config.endDate)})
    </h4>
    <table>
      <thead>
        <tr>
          ${HeaderCell()}
          ${HeaderCell("PR's", 4)}
          ${HeaderCell("Stats", 3)}
          ${HeaderCell("Reviews", 3)}
        </tr>
        <tr>
          ${HeaderCell()}
          ${[...TAGS, ...TIMINGS, ...REVIEWS].map(field => HeaderCell(field)).join('')}
        </tr>
      </thead>
      <tbody>
        ${Object.entries(groupedMetrics).map(([category, { counts, timings }]) => `
          <tr>
            ${HeaderCell(category)}
            ${CountsCells(counts.all)}
            ${TimingCells(timings.all)}
            ${ReviewsCell(counts.all.teamReviewCount)}
            ${ReviewsCell(counts.all.otherReviewCount)}
            ${ReviewsCell(counts.all.totalReviewCount)}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  return tableDiv;
}

function HeaderCell(headerName: string = '', colspan: number = 1): string {
  return `<th colspan="${colspan}">${headerName}</th>`;
}

function TableCell(value: string | number): string {
  return `<td>${value}</td>`;
}

function CountsCells(counts: CountMetrics): string {
  return TAGS.map(tag => TableCell(counts[tag])).join('');
}

function TimingCells(timings: TimingMetrics): string {
  let { entries, summary } = timings;
  let { additions, deletions } = summary;
  let avgAdd = additions / entries.length;
  let avgDel = deletions / entries.length;
  return `
    ${TableCell(humanizeDuration(timings.avgTimeToMerge))}
    ${TableCell(humanizeDuration(timings.avgTimeToReview))}
    ${TableCell(diffSummary(avgAdd, avgDel))}
  `;
}

function ReviewsCell(reviewCount: number): string {
  if (typeof reviewCount !== 'number') {
    return '';
  }

  return TableCell(reviewCount);
}
