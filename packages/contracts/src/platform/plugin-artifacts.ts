import type {
  ArtifactContentInput, ArtifactMetadata, ArtifactReference, ArtifactVersionRecord, ArtifactVersionResult,
} from "../modules/artifacts.js";

export interface PluginArtifactPublishInput extends ArtifactReference {
  artifact_type_id: string;
  schema_version: number;
  content: ArtifactContentInput;
  metadata?: ArtifactMetadata;
  supersedes_version?: number | null;
}

/** Host-bound author surface: project, user and producer identity cannot be supplied by a Plugin. */
export interface PluginArtifactClient {
  publish(input: PluginArtifactPublishInput): ArtifactVersionResult;
  read(reference: ArtifactReference): ArtifactVersionRecord | null;
}
