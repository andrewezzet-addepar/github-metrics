import { PARAMS_FORM_ATTR } from './rendering';

class Config {
  getform(dataAttr: string) {
    return document.querySelector(`[${dataAttr}]`) as HTMLFormElement;
  }

  getValue(formAttr: string, field: string): string {
    return this.getform(formAttr).elements[field].value;
  }

  getValueArray(formAttr: string, field: string): string[] {
    let value = this.getValue(formAttr, field);
    if (!value.trim().length) {
      return [];
    }
    return value.split(',').map(val => val.trim()).filter(val => val.length);
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
    return this.getValueArray(PARAMS_FORM_ATTR, 'repos');
  }

  get usernames() {
    return this.getValueArray(PARAMS_FORM_ATTR, 'usernames');
  }

  getTodayMinusDays(days: number = 0): Date {
    let date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  get initStartDate() {
    return this.getTodayMinusDays(14);
  }

  get initEndDate() {
    return this.getTodayMinusDays();
  }

  get defaults() {
    return {
      username: 'andrewezzet-addepar',
      token: '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',
      start: this.initStartDate.toDateString(),
      end: this.initEndDate.toDateString(),
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