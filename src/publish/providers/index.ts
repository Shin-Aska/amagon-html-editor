// Provider adapters â€” populated in Phases 3â€”5.
// Importing this module triggers adapter registration via side effects.
import {registerPublisher} from '../registry'
import {neocitiesAdapter} from './neocities'
import {cloudflarePagesAdapter} from './cloudflare'
import {githubPagesAdapter} from './github'
import {awsS3Adapter} from './aws-s3'

registerPublisher(neocitiesAdapter);
registerPublisher(cloudflarePagesAdapter);
registerPublisher(githubPagesAdapter);
registerPublisher(awsS3Adapter);

export { NeocitiesAdapter, neocitiesAdapter } from './neocities'
export { CloudflarePagesAdapter, cloudflarePagesAdapter } from './cloudflare'
export { GitHubPagesAdapter, githubPagesAdapter } from './github'
export { AwsS3Adapter, awsS3Adapter } from './aws-s3'

