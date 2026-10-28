// Standard API policy, not a claim that this project has approved Zero Data
// Retention or that its organization has opted out of optional data sharing.
// Source: https://developers.openai.com/api/docs/guides/your-data
export const OPENAI_API_DATA_NOTICE =
  'By default, OpenAI does not use API content to train its models. Under its standard API policy, abuse-monitoring logs may contain submitted images and be retained for up to 30 days, with legal and safety exceptions.';

export const OPENAI_API_DATA_DETAILS =
  `${OPENAI_API_DATA_NOTICE} Longer retention may be required by law. Images flagged as potential child sexual abuse material may be retained for manual review, including under otherwise stricter retention controls. We disable response storage for coaching requests; this does not disable abuse-monitoring logs or guarantee Zero Data Retention. Modified Abuse Monitoring and Zero Data Retention require eligibility and approval from OpenAI. See https://developers.openai.com/api/docs/guides/your-data.`;
