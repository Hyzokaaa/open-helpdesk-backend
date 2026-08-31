interface Props {
  id: string;
  upgradeEnabled: boolean;
  upgradeEmail: boolean;
  upgradeInApp: boolean;
  lastNotifiedVersion: string | null;
}

export class SystemNotificationSettings {
  id: string;
  upgradeEnabled: boolean;
  upgradeEmail: boolean;
  upgradeInApp: boolean;
  lastNotifiedVersion: string | null;

  constructor(props: Props) {
    this.id = props.id;
    this.upgradeEnabled = props.upgradeEnabled;
    this.upgradeEmail = props.upgradeEmail;
    this.upgradeInApp = props.upgradeInApp;
    this.lastNotifiedVersion = props.lastNotifiedVersion ?? null;
  }
}
