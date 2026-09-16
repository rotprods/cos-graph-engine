export interface ProvenanceRef {
  /** Canonical source identity: document, commit, event, message, episode, etc. */
  source: string;
  /** Optional immutable revision or digest of the source material. */
  revision?: string;
  /** Agent, tool or run that produced this record. */
  actor?: string;
  /** Optional source-native locator such as line range, event offset or message ID. */
  locator?: string;
}