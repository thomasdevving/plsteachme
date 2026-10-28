// Standard API policy, not a claim that this project has approved Zero Data
// Retention or that its organization has opted out of optional data sharing.
// Source: https://developers.openai.com/api/docs/guides/your-data
export const OPENAI_API_DATA_POLICY_URL =
  'https://developers.openai.com/api/docs/guides/your-data';

export const CAMERA_COACHING_DATA_NOTICE =
  "Live video stays on your device and is not streamed to OpenAI. During camera coaching, individual images are automatically sent to OpenAI's API for analysis. This app does not store these images.";

export const OPENAI_API_DATA_NOTICE =
  'OpenAI does not use API data to train its models by default. OpenAI may retain submitted data for up to 30 days for safety and abuse monitoring, or longer when legally required or necessary for security. Additional retention may apply depending on the API features used.';

export const OPENAI_API_DATA_DETAILS =
  `${OPENAI_API_DATA_NOTICE} API content is not used for model training unless the API customer explicitly opts in. Images flagged as potential child sexual abuse material may be retained for manual review, including under otherwise stricter retention controls. We disable response storage for coaching requests; this does not disable abuse-monitoring logs or guarantee Zero Data Retention. Modified Abuse Monitoring and Zero Data Retention require eligibility and approval from OpenAI. See ${OPENAI_API_DATA_POLICY_URL}.`;
