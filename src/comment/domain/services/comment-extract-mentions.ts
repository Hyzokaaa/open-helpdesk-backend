export class ExtractMentions {
  execute(content: string): string[] {
    const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }
}
