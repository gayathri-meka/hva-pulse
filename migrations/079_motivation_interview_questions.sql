-- 079: The Motivation (round 1) interview question set.
-- Replaces the placeholder questions: deactivate the old ones, insert the full
-- calibrated set in interview flow order, tagged by bucket (section). Dollar-quoted
-- so quotes/apostrophes need no escaping. Idempotent-ish: re-running re-inserts
-- duplicates, so apply once (or clear round-1 rows first).

-- Retire the old placeholder questions (the 3 examples were round = NULL "both").
UPDATE public.interview_questions SET active = false WHERE round IS NULL OR round = 1;

INSERT INTO public.interview_questions (round, section, ordering, active, prompt, purpose, strong_answer, weak_answer, probe) VALUES
(1, $s$General$s$, 10, true,
 $p$[Read to the candidate] Before we begin, this is just a simple conversation to get to know you better — your life, your goals, and how we can support you. What you share will stay with us and help us support you through HVA. There are no right or wrong answers.$p$,
 $p$Set the tone — rapport and psychological safety.$p$, NULL, NULL, NULL),

(1, $s$General$s$, 20, true,
 $p$Can you share your life story?$p$,
 $p$Identify their challenges and probe further.$p$,
 $p$Should cover: where they're from; what they're studying or doing right now; which languages they're comfortable speaking; one or two things important in their life right now; what they like to do in their free time and why they enjoy it.$p$,
 NULL, NULL),

(1, $s$General$s$, 30, true,
 $p$Five years from now, what does a good life look like for you? Be specific — where are you, what are you doing, who are you taking care of?$p$,
 NULL,
 $p$Goes beyond the label (company/role) into specific life details — family, location, daily life, who they're taking care of.
Shows the answer is something they've actually thought about before, not constructed live.
Realistic given their starting point, even if ambitious.$p$,
 $p$Visibly stuck or repeats the same vague phrase when probed.
Stops at a label — "I want to work at Google," "I want to be a developer" — with no detail even after probing.
Generic enough that any learner could say it, regardless of background.$p$,
 NULL),

(1, $s$Drive$s$, 40, true,
 $p$Tell me about something you did that you felt good about, even if no one else noticed.$p$,
 $p$Surfaces self-driven effort and intrinsic motivation without needing a conventional achievement — accessible across backgrounds.$p$,
 $p$Something small and specific nobody formally recognised — e.g. "I taught myself to fix our home's electrical board because we couldn't afford an electrician; it took 3 days of watching videos."
Internal satisfaction — "I didn't tell anyone but I felt I'd figured something out on my own."
Often completely non-academic. The pride is quiet, not performative — they may hesitate because it feels small.$p$,
 $p$"I got first rank and my parents were happy." / "I won a college competition."
Conventional achievement framed as personal; the "even if no one noticed" part is ignored.
Reveal is about external validation — rank, prize, approval.$p$,
 $p$"That's something others noticed too — can you think of something you did just for yourself, where the only person who knew was you?"
"What made you feel good — the result or the process?"
"Did you tell anyone? Why or why not?"
[If struggling: it doesn't have to be big — home, studies, work, helping someone, learning something, handling a hard situation.]$p$),

(1, $s$Drive$s$, 50, true,
 $p$When you were going through the 14-day challenge, was there a problem or concept you got stuck on? What did you do?$p$,
 NULL,
 $p$Names a specific concept — "I got stuck on CSS flexbox, my elements wouldn't center."
Describes the actual process — tried one thing, then a video, then asked in the group.
May admit they gave up on that problem and moved on — honest and real.
Shows real frustration or confusion, not a clean hero story.$p$,
 $p$"Yes I got stuck but I searched Google and figured it out." / "I watched YouTube and solved it."
No concept named, no real struggle — sounds like reciting the "right" way to handle being stuck.$p$,
 $p$"Which specific concept got you stuck?"
"How long before you figured it out?"
"What exactly did you search for?"
Cross-check SensAI data — did their activity show struggle on any concept?$p$),

(1, $s$Drive$s$, 60, true,
 $p$Tell me about a time when things were not going well for you. What did you do? (Anything you're comfortable with — studies, family, money, confidence, health, work.)$p$,
 $p$Response to personal difficulty.$p$,
 $p$Specific situation with real context — "in second year my father lost his job and I started working at a shop in the evenings."
Describes the specific steps they took, however small.
May not have a clean resolution — "things are still not fully okay but I'm managing."
Shows emotion without performing it — may pause, trail off, or simplify.$p$,
 $p$"I failed an exam, was sad, then studied harder and passed." / "We had money problems but I stayed positive."
Clean arc with no texture; ends with a tidy lesson because they think that's what you want.$p$,
 $p$"What specifically did you do in the first week when this happened?"
"Who helped you during that time?"
"Did things fully get better, or are you still dealing with it?"$p$),

(1, $s$Drive$s$, 70, true,
 $p$Tell me about a time you didn't get something you were expecting or working towards. What happened after that?$p$,
 $p$Response to external setback/blame.$p$,
 $p$Stays in the difficulty for a moment before resolving — "I was angry for weeks, didn't know what to do."
Describes a specific next step — "I asked my senior why I wasn't selected."
May still feel some bitterness — that's real and honest.
"What happened after" has real detail, not just "I tried again."$p$,
 $p$"I didn't get selected but I learned from it and tried again." / "Someone got it due to favouritism, I felt bad but moved on."
Moves too fast to resolution; "I moved on" with no detail of how.$p$,
 $p$"How long before you figured out what to do next?"
"What was the first thing you did after you found out?"
"Do you feel it was fair? Why?"$p$),

(1, $s$Drive$s$, 80, true,
 $p$Tell me about a time when something was going wrong around you — at home, in college, or anywhere. What did you do?$p$,
 $p$Proactive initiative.$p$,
 $p$Names a specific situation — "my mother was sick for 3 months and my father was panicking about money."
Describes what they actually did — "I started cooking and managing the house so my father could focus on work."
May mention they weren't asked to step in — they just did.
Shows the cost of stepping up; not necessarily a clean resolution.$p$,
 $p$"There was a family problem and I helped solve it." / "My friend was struggling so I supported them."
Vague situation, vague action; hero framing with no detail; ends with "everything worked out fine."$p$,
 $p$"Who asked you to get involved, or did you decide on your own?"
"Walk me through exactly what you did."
"What happened as a result of what you did?"
"Was there anyone else who could have stepped in instead of you?"$p$),

(1, $s$Drive$s$, 90, true,
 $p$What do you know about how HVA works? What are you expecting the next 6 months to look like?$p$,
 $p$Checks whether they engaged seriously with the 14-day challenge and understand what they're signing up for — especially for first-time learners.$p$,
 $p$Mentions specific elements they experienced — "during the challenge I had standups every day and submitted tasks."
Realistic about difficulty; may have specific questions about the program; understands it's self-learning.$p$,
 $p$"It's a 6-month program where I learn coding and get a job." / "There are mentors and LFs who help me."
Surface level — like they memorised the website; no real sense of daily life in HVA.$p$,
 $p$"What was the 14-day challenge like for you? What surprised you?"
"What do you think will be the hardest part of the next 6 months for you specifically?"
"Have you spoken to any HVA alumni? What did they tell you?"$p$),

(1, $s$Need$s$, 100, true,
 $p$Why is joining HVA important for you? If you don't get into HVA, what is your Plan B?$p$,
 $p$Tests genuine dependency on this specific opportunity and whether the learner has real agency/alternatives.$p$,
 $p$"I looked at other courses but they cost ₹50,000 which I can't afford."
"My college doesn't have good placements and I don't know anyone in tech — HVA is the only real path I can see."
Plan B is genuinely weak or vague; connects HVA specifically to a gap in their situation.$p$,
 $p$"HVA is a great program and it's free, it'll help me get a tech job."
"I don't have a Plan B because I really want to join." (said to sound committed, not genuinely thought through)
Generic praise not connected to their specific situation.$p$,
 $p$"Have you looked at any other programs or courses? What did you find?"
"If HVA says no today, what's your next step tomorrow?"
"Why HVA over other programs?"$p$),

(1, $s$Drive$s$, 110, true,
 $p$If you complete HVA and get a job — what will change in your life in the first year?$p$,
 NULL,
 $p$Specific and personal — "first clear my father's ₹1.5 lakh loan, then help my sister study without worrying about fees."
Thought about the order of priorities, not just a list; may include something unexpected (rent a room near office); realistic on timeline ("even ₹20,000 will make a difference").$p$,
 $p$"I'll get a good job, support my family, and keep learning."
Three generic points with no specific detail — could be any learner.$p$,
 $p$"What specifically would change at home if you earned ₹20,000 a month?"
"What's the first thing you'd do with your first salary?"
"What does your family expect from you once you get a job?"$p$),

(1, $s$Need$s$, 120, true,
 $p$Is the income (from the form) correct? (Yes / No)$p$, NULL, NULL, NULL, NULL),

(1, $s$Need$s$, 130, true,
 $p$Can you tell me a little about your family — who is at home, what do they do, and how is the financial situation at home?$p$,
 NULL,
 $p$Mentions specific amounts — "my father earns around ₹8,000 a month driving an auto, but it's not consistent."
Names real tensions — "my brother stopped working so my father is the only one earning."
May contradict itself slightly or trail off — real situations are messy; details match form data on income and family size.$p$,
 $p$"Father is a farmer, mother a housewife, 4 members, situation not good so I need a job."
Hits expected points but stays surface level; clean, rehearsed, no contradictions.$p$,
 $p$"How much does each earner make roughly per month?"
"Who pays for your college fees currently?"
"Are there any loans or debts at home right now?"$p$),

(1, $s$Need$s$, 140, true,
 $p$If you don't get a job in the next 1 year, what happens at home?$p$,
 NULL,
 $p$"My father has a ₹2 lakh loan and expects me to start contributing by next year."
"My younger sister's college fees are due and there's no one else to pay."
Names a specific family member waiting on them; has a timeline and a real consequence, not just a feeling.$p$,
 $p$"My family will struggle, I need to support them." / "It will be very difficult for us."
Emotionally charged but vague — no specific person, amount, or consequence named.$p$,
 $p$"Who specifically would be most affected?"
"What would your family do in that situation?"
"Is there anyone else at home who could step in?"$p$),

(1, $s$Need$s$, 150, true,
 $p$How much salary are you expecting from your first job? What would you do with that money?$p$,
 NULL,
 $p$"I need at least ₹15,000 — ₹8,000 for rent and food, ₹5,000 to send home, and some for transport."
Mentions a specific obligation (an EMI of ₹3,000 they want to take over); may have unrealistic expectations (itself a signal); answer comes quickly and specifically.$p$,
 $p$"Around ₹20,000 to ₹25,000. I'll support my family and save some."
Range sounds reasonable but the breakdown is vague; "support family and save" is the default answer.$p$,
 $p$"If ₹20,000 came into your account on the 1st, walk me through where it goes."
"How much would you send home every month?"
"Any specific expenses you're planning for?"$p$),

(1, $s$Time & Commitment$s$, 160, true,
 $p$Walk me through yesterday — what did you do from the time you woke up to the time you slept? Is that a typical day for you, or was yesterday different?$p$,
 NULL,
 $p$Has gaps and idle time; mentions travel time; includes real life (helping with cooking in the evening); may not remember exactly; acknowledges if yesterday was different from usual.$p$,
 $p$"Woke at 7, college till 4, came back and studied till 10, then slept."
Clean and structured with no gaps — sounds ideal rather than real; every hour productive; no travel, meals, breaks, phone, or family responsibilities.$p$,
 $p$"What time did you actually wake up yesterday?"
"How long does it take you to get to college and back?"
"What did you do between coming home and sleeping?"
"When did you last open SensAI or do something related to learning?"$p$),

(1, $s$Time & Commitment$s$, 170, true,
 $p$How will HVA fit into your daily schedule? How many hours will you give to the program?$p$,
 NULL,
 $p$Number is realistic and connects to their actual schedule — "college ends at 5, I get home by 6, I can give maybe 3 to 4 hours in the evening."
Acknowledges variation (more on weekends) and constraints (less during exams); consistent with the form or explains the difference.$p$,
 $p$"I can give 6 to 8 hours every day." / "I'll manage my time and give as much as needed."
High and confident with no acknowledgment of constraints; doesn't connect to the schedule they just described.$p$,
 $p$"Looking at the schedule you just described, where exactly would those hours fit?"
"What would you have to stop doing to make that time available?"
"In the 14-day challenge, how many hours were you actually putting in per day?"$p$),

(1, $s$Time & Commitment$s$, 180, true,
 $p$How does your next 6 months look? Any major events or breaks anticipated? (Look for exams, internship, marriage, festivals, vacation.)$p$,
 NULL,
 $p$Proactively mentions specific events — "Diwali is in October so I'll probably go home for a week."
Gives exam months; has thought about how to manage around them; may mention something uncertain.$p$,
 $p$"Nothing major, I'll be fully available." / "Maybe some exams but I'll manage."
Minimises everything to appear maximally available; no festivals, family events, or travel unless directly asked.$p$,
 $p$"Any festivals coming up where you'd need to travel home?"
"When are your next semester exams?"
"Any family events — weddings, functions — in the next 6 months?"
"Any travel planned?"$p$),

(1, $s$Time & Commitment$s$, 190, true,
 $p$Can you share about your exams or other commitments for the next 6 months?$p$, NULL, NULL, NULL, NULL),

(1, $s$Time & Commitment$s$, 200, true,
 $p$During your last exam period, did you stop doing anything else to focus on exams?$p$,
 NULL,
 $p$Honest about tradeoffs — "I stopped going to the gym and cut back during exams."
Specific about time (about 6 hours a day for 2 weeks); may admit they shut down completely; self-aware about their own pattern.$p$,
 $p$"I managed everything — I studied for exams and also continued other things." / "I'm good at time management so exams don't affect me much."
Presents themselves as handling everything perfectly; no tradeoffs acknowledged.$p$,
 $p$"How many hours a day were you studying during your last exam period?"
"Did you continue the 14-day challenge during exams or did you pause?"
"How many days before exams do you usually start preparing?"$p$),

(1, $s$Time & Commitment$s$, 210, true,
 $p$Do you or any of your family members have health conditions that require you to take breaks? (Only if you're comfortable sharing — we're only trying to help you.)$p$,
 NULL, NULL, NULL, NULL),

(1, $s$Program Alignment$s$, 220, true,
 $p$How did you first hear about web development, and what made you want to explore it further?$p$,
 NULL,
 $p$Has a specific moment or person — "my college senior showed me a website he built and I was curious how he did it."
May be completely practical — "it pays well and I needed a skill I could learn online for free" — honesty is the signal, not the reason.
Describes a specific action they took after (watched a few videos); may connect to something personal.$p$,
 $p$"I heard about web development and found it very interesting, I like building websites." / "Tech has good scope and salary so I decided to pursue it."
Generic interest with no specific moment or trigger; could apply to any learner.$p$,
 $p$"When exactly did you first come across it — recently or a while ago?"
"What was the first thing you did after you heard about it?"
"Did you try anything on your own before the 14-day challenge?"$p$),

(1, $s$Program Alignment$s$, 230, true,
 $p$Favourite subject in school? What do you feel about Math?$p$,
 NULL,
 $p$Names a subject with a real reason — "I liked Science because my teacher made it interesting."
Honest about Math — "I was okay but I found algebra confusing."
Shows self-awareness — "I'm not great at Math but I don't give up when something is hard."
May name a non-STEM subject — the signal is self-awareness, not the subject.$p$,
 $p$"My favourite was Math, I love logical thinking and problem solving."
Says Math because they think that's what a tech program wants to hear; no specific detail; overly positive with no acknowledged difficulty.$p$,
 $p$"What specifically did you like about it?"
"Which topics did you find hard?"
"How did you handle it when you got stuck on a problem?"$p$),

(1, $s$Program Alignment$s$, 240, true,
 $p$When will you start applying for jobs?$p$,
 NULL,
 $p$Understands the timeline — "after at least 4 to 5 months, once I have something solid to show."
May show real tension (would apply earlier if something great came up); has thought about what "ready" means; connects to their financial situation; similar to their form answer.$p$,
 $p$"I'll apply after completing HVA." / "Whenever HVA says I'm ready."
Complete compliance with no genuine thinking behind it; different from the form answer.$p$,
 $p$"What would make you feel ready to apply?"
"If a good opportunity came up in month 2, what would you do?"
"How are you planning to manage financially until you start applying?"$p$),

(1, $s$Program Alignment$s$, 250, true,
 $p$If you got a non-tech job offer tomorrow with a decent salary — say ₹15,000 a month — would you take it or wait for a tech job? Why?$p$,
 NULL,
 $p$Has a specific vision of what tech will do for their life that non-tech won't.
Can articulate a real difference — salary trajectory, growth, stability — not just "tech is good."
May reference someone they know or a story that shaped their thinking; gets more specific when pushed, not more vague.$p$,
 $p$Repeats the same answer — "tech has scope," "tech pays well."
Gets vaguer when pushed, not more specific; can't articulate what specifically tech will change; sounds recited.$p$,
 $p$"Why do you think waiting for a tech job is worth it?"
"What makes you believe tech is the right path for you?"
"What would be different about your life with a tech job vs a non-tech job?"
"Have you spoken to anyone in a tech job? What did they tell you?"$p$),

(1, $s$Program Alignment$s$, 260, true,
 $p$Why are you willing to pause or quit your current work?$p$,
 NULL,
 $p$Acknowledges the real cost — "I earn ₹12,000 right now and leaving will be hard for my family for a few months."
Has a specific reason the current job isn't enough — "I'm doing data entry and there's no future in it."
Has thought about how they'll manage financially during HVA; the decision was not taken lightly.$p$,
 $p$"I want to grow in my career so I'm willing to leave my job." / "My current job has no growth so I want to upskill."
Rational but generic; no real cost of leaving or financial impact acknowledged.$p$,
 $p$"How will your family manage financially while you're not earning?"
"Have you already spoken to your family about this decision?"
"What does your current employer think about you leaving?"$p$),

(1, $s$Program Alignment$s$, 270, true,
 $p$Why are you willing / not willing to move to a non-tech job?$p$,
 NULL,
 $p$Grounded in real observation — "non-tech jobs in my area don't go beyond ₹15,000–20,000 even after 5 years, I've seen relatives stuck there; tech is the only way I can change my situation."
Past experience driving conviction; specific trajectory thinking; a personal reference point; acknowledges the real tension but has a clear reason for choosing tech anyway.$p$,
 $p$"I want tech because it has good salary and scope." (generic)
"Any job is fine, I just need one." / "Tech is better but non-tech is also okay."
Indifference or fence-sitting; urgency or family pressure overriding tech commitment — high dropout risk.$p$,
 NULL),

(1, $s$Program Alignment$s$, 280, true,
 $p$Why do you not want to relocate?$p$,
 NULL,
 $p$Has a specific reason — "my mother is unwell and I can't move too far from home right now."
Has thought about it / spoken to family; may be open to certain cities ("Chennai is closer to home, but not Delhi"); honest without being defensive; similar to the form.$p$,
 $p$"I'm open to relocating if needed." (correcting their form answer) / "I had some concerns before but I'm fine now."
Backtracks on the form answer with no real explanation; different from the form.$p$,
 $p$"Is this a permanent constraint or something that might change in 6 months?"
"Are there specific cities you'd be open to?"
"Have you spoken to your family about this?"$p$),

(1, $s$Program Alignment$s$, 290, true,
 $p$Is the learner convinced about relocation? (Yes / No / Partially / We should accommodate)$p$, NULL, NULL, NULL, NULL),

(1, $s$Program Alignment$s$, 300, true,
 $p$How would you rate your college placements? Why? What placement support do you get? How many students from your batch/stream got placed in previous years?$p$,
 NULL,
 $p$Gives specific numbers — "out of 60 students in my branch last year, maybe 8 to 10 got placed."
Knows what the placement cell actually does; has personally engaged (went for a drive); cross-checkable against college data in Pulse; reflects understanding built during the 14-day challenge.$p$,
 $p$"Placements are not good in my college, that's why I joined HVA."
Says what they think HVA wants to hear; no specific numbers, no real engagement; may inflate or deflate; different from their 14-day challenge answer.$p$,
 $p$"How many students in your branch got placed last year?"
"What companies typically come to your college?"
"How many got placed in the same branch you studied?"$p$),

(1, $s$Program Alignment$s$, 310, true,
 $p$[If from Navgurukul / College] How often will you go home? Will you have a laptop when you go home? (Exams / festivals)$p$,
 NULL,
 $p$Honest about frequency — "I usually go home once a month or during festivals."
Specific about the laptop situation; has thought about connectivity ("my village doesn't have good internet, I'll plan around that"); aware they'll need to make up hours when travelling.$p$,
 $p$"I won't go home much, I'll always have my laptop."
Minimises home visits to appear maximally available; no festivals, family obligations, or travel time acknowledged.$p$,
 $p$"When was the last time you went home? How long were you there?"
"What's the internet situation like at your home?"
"During Diwali / Pongal / Eid, how long do you usually stay?"$p$),

(1, $s$Program Alignment$s$, 320, true,
 $p$Can you tell me more about your internship / training — when does it start, how many hours per week, how will it affect your schedule?$p$,
 NULL,
 $p$Specific about time commitment — "it's 2 hours every Saturday morning."
Has thought about the conflict — "I can manage both but HVA will be my priority."
Honest if there's a real conflict ("it overlaps but I'll drop it if needed"); can name the course, duration, and what they hope to get from it.$p$,
 $p$"It's just a small course, it won't affect HVA at all."
Minimises the other commitment; no specific details about hours or schedule.$p$,
 $p$"How many hours per week does it take?"
"If HVA and this clash, which would you prioritise?"
"When does it end?"$p$),

(1, $s$Program Alignment$s$, 330, true,
 $p$[If expecting more than 5 LPA] Give a reality check on salary. Is the learner convinced? (Yes / No / Partially)$p$, NULL, NULL, NULL, NULL),

(1, $s$Program Alignment$s$, 340, true, $p$Laptop? (Yes / No / Maybe)$p$, NULL, NULL, NULL, NULL),
(1, $s$Program Alignment$s$, 350, true, $p$Stable internet? (Yes / No / Maybe)$p$, NULL, NULL, NULL, NULL),
(1, $s$General$s$, 360, true, $p$Willing to pay it forward? (Yes / No / Maybe)$p$, NULL, NULL, NULL, NULL),
(1, $s$General$s$, 370, true, $p$Questions for us?$p$, NULL, NULL, NULL, NULL),
(1, $s$General$s$, 380, true, $p$Red flag comments (interviewer notes)$p$, NULL, NULL, NULL, NULL),
(1, $s$General$s$, 390, true, $p$Green flag comments (interviewer notes)$p$, NULL, NULL, NULL, NULL),
(1, $s$General$s$, 400, true, $p$Time category (Full Time - NG / Full Time - Non NG / Part Time - College)$p$, NULL, NULL, NULL, NULL);
