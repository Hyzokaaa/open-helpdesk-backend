export interface Query<Props, Result> {
  execute(props: Props): Promise<Result>;
}
