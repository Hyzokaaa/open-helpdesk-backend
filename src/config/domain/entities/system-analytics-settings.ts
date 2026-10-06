import { AnalyticsProvider } from '../enums/analytics-provider.enum';

interface Props {
  id: string;
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies?: boolean;
  trackEvents?: boolean;
}

export class SystemAnalyticsSettings {
  id: string;
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies: boolean;
  trackEvents: boolean;

  constructor(props: Props) {
    this.id = props.id;
    this.provider = props.provider ?? null;
    this.serverUrl = props.serverUrl ?? null;
    this.siteId = props.siteId ?? null;
    this.useCookies = props.useCookies ?? false;
    this.trackEvents = props.trackEvents ?? true;
  }
}
