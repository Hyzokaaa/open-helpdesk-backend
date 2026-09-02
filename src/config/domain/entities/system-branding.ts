interface Props {
  id: string;
  appName: string | null;
  appSubtitle: string | null;
  logo: string | null;
  icon: string | null;
}

export class SystemBranding {
  id: string;
  appName: string | null;
  appSubtitle: string | null;
  logo: string | null;
  icon: string | null;

  constructor(props: Props) {
    this.id = props.id;
    this.appName = props.appName ?? null;
    this.appSubtitle = props.appSubtitle ?? null;
    this.logo = props.logo ?? null;
    this.icon = props.icon ?? null;
  }
}
