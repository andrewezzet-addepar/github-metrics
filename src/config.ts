import { PARAMS_FORM_ATTR } from './rendering';
import { getTodayMinusDays } from './utils';

const DEBUG = false;

function makeStorageKey(field: string): string {
  return `x-github-${field}`;
}

export const FIELD_NAMES = {
  start: 'start',
  end: 'end',
}

export const STORED_FIELD_NAMES = {
  token: 'token',
  username: 'username',
  remember: 'remember',
  repos: 'repos',
  usernames: 'usernames'
}

export const INPUT_TYPES = {
  string: 'string',
  boolean: 'boolean',
  array: 'array'
}

export const FIELD_TYPES = {
  token: INPUT_TYPES.string,
  username: INPUT_TYPES.string,
  remember: INPUT_TYPES.boolean,
  repos: INPUT_TYPES.array,
  usernames: INPUT_TYPES.array
}

class Config {
  getForm(dataAttr: string) {
    return document.querySelector(`[${dataAttr}]`) as HTMLFormElement;
  }

  getFieldInput(field: string): HTMLInputElement {
    return this.getForm(PARAMS_FORM_ATTR).elements[field];
  }

  getFormValueAsString(field: string): string {
    return this.getFieldInput(field).value;
  }

  getFormValueAsBoolean(field: string): boolean {
    return this.getFieldInput(field).checked;
  }

  getFormValueAsArray(field: string): string[] {
    let value = this.getFieldInput(field).value;
    return this.getValueArray(value);
  }

  getValueArray(value: string): string[] {
    if (!value.trim().length) {
      return [];
    }
    return value.split(',').map(val => val.trim()).filter(val => val.length);
  }

  get username() {
    return this.getFormValueAsString(STORED_FIELD_NAMES.username);
  }

  get token() {
    return this.getFormValueAsString(STORED_FIELD_NAMES.token);
  }

  get remember() {
    return this.getFormValueAsBoolean(STORED_FIELD_NAMES.remember);
  }

  get repos() {
    return this.getFormValueAsArray(STORED_FIELD_NAMES.repos);
  }

  get usernames() {
    return this.getFormValueAsArray(STORED_FIELD_NAMES.usernames);
  }

  get start() {
    return this.getFormValueAsString(FIELD_NAMES.start);
  }

  get end() {
    return this.getFormValueAsString(FIELD_NAMES.end);
  }

  get startDate() {
    return new Date(this.start);
  }

  get endDate() {
    return new Date(this.end);
  }

  get storage() {
    return chrome.storage.sync ?? chrome.storage.local
  }

  async getStored(field: string) {
    let key = makeStorageKey(field);
    return (await this.storage.get(key))[key];
  }

  async initStoredField(field: string) {
    return await this.getStored(field) ?? this.defaults[field];
  }

  initField(field: string) {
    return this.defaults[field];
  }

  async store(field: string, value: string | boolean | string[]) {
    let key = makeStorageKey(field);
    await this.storage.set({ [key]: value });
  }

  async clearAllStored() {
    await this.storage.clear();
    await this.store(STORED_FIELD_NAMES.remember, false);
  }

  async updateAllStored(clear: boolean) {
    if (clear) {
      return this.clearAllStored();
    }

    for (let field of Object.keys(STORED_FIELD_NAMES)) {
      await this.store(field, this[field]);
    }
  }

  storedValueChanged(input: HTMLInputElement) {
    if (input.name === 'remember') {
      this.updateAllStored(!input.checked);
    } else if (this.remember) {
      this.store(input.name, input.value);
    }
  }

  get defaults() {
    return {
      username: '',
      token: '',
      remember: true,
      repos: ['AMP', 'Iverson'],
      usernames: [],
      end: getTodayMinusDays(),
      start: getTodayMinusDays(14),
    };
  }
}

export default new Config();