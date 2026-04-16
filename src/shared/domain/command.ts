export interface Command<Props, Result> {
  execute(props: Props): Promise<Result>;
}
