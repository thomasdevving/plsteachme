# Build plan
Name: plsteach.me throughout; brand constant in lib/config.ts.
Pages: landing, organizations, demo, privacy, thanks, custom 404; dev-only component gallery. Dutch at / and English at /en, with translated organization and thanks paths. Small typed NL/EN dictionaries.
Components: navigation/footer, Button/Card/Chip/Section/FormField, SVG skill icons, phone illustration, coaching loop, demo video, skill votes, waitlist, organization form, referral/follow-up.
Phases: foundation → complete bilingual landing → forms, server validation and SQL → secondary pages, metadata/OG/analytics → checks, accessibility and documentation. User authorized continuous implementation and self-repair; no phase gates.

Hero choices (option 1 selected provisionally to continue without blocking):
1. NL: Je hoeft het niet alleen uit te zoeken. / Leer praktische dingen met een AI-coach die meekijkt terwijl je oefent.
   EN: You don’t have to figure it out alone. / Learn practical skills with an AI coach that watches you practice.
2. NL: Soms heb je gewoon iemand nodig die meekijkt. / Van je eerste stropdas tot een knoop aannaaien. Oefen stap voor stap, met geduldige hulp.
   EN: Sometimes you just need someone to guide you. / From your first tie to sewing on a button. Practice step by step, with patient guidance.
3. NL: Voor alles wat niemand je heeft geleerd. / Kies iets wat je wilt leren. Zet je telefoon neer. Je AI-coach helpt je op weg.
   EN: For the things nobody taught you. / Pick something you want to learn. Prop up your phone. Your AI coach helps you get started.

Deployment: retain the explicitly requested Next.js/Vercel runtime. Local preview and Vercel-ready source; production deployment needs the owner's Vercel project/account configuration.

Latest user direction supersedes the provisional hero option: English eyebrow “Nobody should have to figure everything out alone.”, heading “A little help. A skill for life.”, support “For the things nobody showed you. Take them one step at a time, at your own pace.” Dutch follows the same meaning. Marketing copy across the site is shorter; operational, consent and privacy meaning is retained.
