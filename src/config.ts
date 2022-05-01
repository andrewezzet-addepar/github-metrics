import { PARAMS_FORM_ATTR } from './rendering';

export const GITHUB_KEYS = {
  token: 'x-github-token',
  username: 'x-github-username',
  remember: 'x-github-remember'
}

const DEBUG = false;

class Config {
  getForm(dataAttr: string) {
    return document.querySelector(`[${dataAttr}]`) as HTMLFormElement;
  }

  getFieldElement(field: string): HTMLInputElement {
    return this.getForm(PARAMS_FORM_ATTR).elements[field];
  }

  getFormValue(field: string): string {
    return this.getFieldElement(field).value;
  }

  getFormValueBoolean(field: string): boolean {
    return this.getFieldElement(field).checked;
  }

  getFormValueArray(field: string): string[] {
    let value = this.getFormValue(field);
    if (!value.trim().length) {
      return [];
    }
    return value.split(',').map(val => val.trim()).filter(val => val.length);
  }

  get username() {
    return this.getFormValue('username');
  }

  get token() {
    return this.getFormValue('token');
  }

  get remember() {
    return this.getFormValueBoolean('remember');
  }

  get start() {
    return this.getFormValue('start');
  }

  getStartDate() {
    return new Date(this.start);
  }

  get end() {
    return this.getFormValue('end');
  }

  getEndDate() {
    return new Date(this.end);
  }

  get repos() {
    return this.getFormValueArray('repos');
  }

  get usernames() {
    return this.getFormValueArray('usernames');
  }

  getTodayMinusDays(days: number = 0): Date {
    let date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  initStartDate() {
    return this.getTodayMinusDays(14).toDateString();
  }

  initEndDate() {
    return this.getTodayMinusDays().toDateString();
  }

  get storage() {
    return chrome.storage.sync ?? chrome.storage.local
  }

  async getStored(key: string) {
    await this.logAllStored();
    return (await this.storage.get(key))[key];
  }

  async initUsername() {
    return await this.getStored(GITHUB_KEYS.username) ?? '';
  }

  async initToken() {
    return await this.getStored(GITHUB_KEYS.token) ?? '';
  }

  async initRemember() {
    return await this.getStored(GITHUB_KEYS.remember) ?? true;
  }

  async logAllStored() {
    if (!DEBUG) {
      return;
    }
    console.log(await this.storage.get(Object.values(GITHUB_KEYS)));
  }

  async store(key: string, value: string | boolean) {
    if (DEBUG) {
      console.log(key, value);
    }
    await this.storage.set({ [key]: value });
    await this.logAllStored();
  }

  async clearAllStored() {
    this.logAllStored();
    await this.storage.clear();
    await this.store(GITHUB_KEYS.remember, false);
    await this.logAllStored();
  }

  async updateStore(clear: boolean) {
    if (clear) {
      return this.clearAllStored();
    }

    for (let field of Object.keys(GITHUB_KEYS)) {
      let key = GITHUB_KEYS[field];
      let value = field === 'remember'
        ? this.getFormValueBoolean(field)
        : this.getFormValue(field);
      await this.store(key, value)
    }
  }

  storedValueChanged(input: HTMLInputElement) {
    if (input.name === 'remember') {
      this.updateStore(!input.checked);
    } else if (this.remember) {
      this.store(GITHUB_KEYS[input.name], input.value);
    }
  }

  get defaults() {
    return {
      repos: ['AMP', 'Iverson'],
      usernames: [
        'tweseley',
        'andrewezzet-addepar',
        'laurenpitruz',
        'kyle-simmons',
        'javoltaire',
      ],
    };
  }
}

export default new Config();