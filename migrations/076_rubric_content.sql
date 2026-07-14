-- 076: Full calibrated rubric content (per-score what-it-means, examples, what-to-look-for).
-- Self-contained upsert — creates or refreshes all six rubrics. Depends on 075 (per-score
-- looking_for_1..4 columns). Dollar-quoted so quotes/apostrophes need no escaping.

-- ── Need ────────────────────────────────────────────────────────────────────
INSERT INTO public.interview_rubrics (key, label, ordering, active,
  level_1, level_2, level_3, level_4,
  example_1, example_2, example_3, example_4,
  looking_for_1, looking_for_2, looking_for_3, looking_for_4)
VALUES ('need', 'Need', 1, true,
  $rub$Low Need: No real financial pressure evident. Family is stable. Has strong alternative paths — good placements, family support, other programs. HVA is a convenience not a necessity.$rub$,
  $rub$Moderate Need: Some financial pressure but not urgent. Situation is manageable without HVA. Alternatives exist but are not strong. Learner wants HVA but doesn't critically need it.$rub$,
  $rub$High Need: Clear financial pressure with specific consequences named. Limited alternatives. HVA fills a real gap. Minor inconsistencies in answers but overall picture is genuine.$rub$,
  $rub$Very High Need: Immediate financial urgency with specific family members and obligations named. No realistic alternative path visible. HVA is genuinely the only viable option. Answers are consistent and specific throughout.$rub$,
  $rub$"Career change, wants to be close to technology. No financial needs. Having a job will give stress free ability" — no family dependency, job is a lifestyle choice
"Currently i dont need a job as im studying" — no urgency whatsoever
"Want to be independent. Feel bad to take money from others" — personal pride, not financial necessity$rub$,
  $rub$"I watched YouTube videos to learn" — some self-initiation but surface level
"I am learning HTML, CSS, JS. Just started FE" — started but very recently, no sustained effort
"She will try to do self learning" — intention without track record
"Completing six months course in HVA, give her best for that" — plan is entirely dependent on HVA, no independent action$rub$,
  $rub$"Family income is 18k, expense is more than 18k, because his sister and he is studying" — specific numbers, real constraint
"My father dont earn that much and i have my siblings and they need support too" — specific dependents named
"Father is an auto driver, he is old and her sister is also studying" — specific situation, named dependents, time pressure
"We have a bank loan, if I don't get a job soon my father will have to take another loan" — specific consequence named
"Sister's marriage is coming up and we have a loan from the bank" — specific upcoming financial obligation
"Family income is not great, brother is the only one earning, wants to help" — specific earning structure named$rub$,
  $rub$"Parents have expired and she and her younger sister are the only one in the family and there is no source of income" — no earning member, complete dependency
"Father is the only earning member that too through PF" — single earner, no savings, no backup
"Father had a heart attack, he is having two blocks and because of that he is not capable of going for work" — primary earner incapacitated with specific medical detail
"Loan around 8-10 lakhs, dependent on grandparents, mother had an accident" — specific loan amount, multiple crises
"I need a job because my siblings depends on me and little sister is sick right now" — immediate medical emergency and dependents named
"More than 10 lakhs loan, paying interest, informal debt is there, people are asking money from them" — active debt pressure from multiple sources
"Father has diabetes, BP issues, gastric problems" combined with no stable income — health crisis directly affecting earning capacity
"Due to financial condition and her father is suffering from CKD — kidney disease, lot of money is going in treatment" — ongoing medical expense draining family resources$rub$,
  $rub$Signal: Family is stable. No loans, no dependents, no health crises. Learner wants a job for personal growth or independence, not out of genuine necessity. HVA would be a convenience, not a turning point.$rub$,
  $rub$Signal: Some effort shown but reactive rather than proactive. Actions taken when pushed by circumstances, not self-initiated. Limited evidence of sustained independent effort.$rub$,
  $rub$What does NOT qualify for Score 3:
"We have some debt but I don't know the amount" — honest but not specific enough
"Family is struggling financially" — generic with no named consequence
"Want to support family" — aspiration without specific obligation

Signal: Specific people named, specific financial situation described, real consequence if no job. Situation is difficult but currently manageable.$rub$,
  NULL)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  example_1 = EXCLUDED.example_1, example_2 = EXCLUDED.example_2, example_3 = EXCLUDED.example_3, example_4 = EXCLUDED.example_4,
  looking_for_1 = EXCLUDED.looking_for_1, looking_for_2 = EXCLUDED.looking_for_2, looking_for_3 = EXCLUDED.looking_for_3, looking_for_4 = EXCLUDED.looking_for_4,
  updated_at = now();

-- ── Drive ───────────────────────────────────────────────────────────────────
INSERT INTO public.interview_rubrics (key, label, ordering, active,
  level_1, level_2, level_3, level_4,
  example_1, example_2, example_3, example_4,
  looking_for_1, looking_for_2, looking_for_3, looking_for_4)
VALUES ('drive', 'Drive', 2, true,
  $rub$No evidence: No past instance of ownership or self-initiated action. Either blank, vague, or entirely dependent on others for direction.$rub$,
  $rub$Reactive: Has taken responsibility but only when asked, when forced by circumstance, or when no one else was available. Low stakes. No real cost involved.$rub$,
  $rub$Proactive: Has self-initiated ownership in at least one real context without being told. Can explain why they stepped up. Some cost or effort involved. Specific and verifiable.$rub$,
  $rub$Sustained: Shows a pattern of ownership across multiple contexts over time. Acted against circumstances, not just within them. Real personal cost (Real personal cost means they gave up or risked something tangible to take ownership). Intrinsically motivated.$rub$,
  $rub$"Nothing"
"Nil, he was not able to give any such situations"
"I dont have any such situation"
"Nil, but she wants to take care of her parents"
"Till now she never got a chance to take responsibility, her father and brother are the ones who take all responsibility"
"He was not able to give any such situations"$rub$,
  $rub$"In 10th class when his class leader was absent he took the responsibility as the class leader. His teacher told him he was the right person" — only acted because teacher asked
"He took responsibility for trip — became a guide for friends. The place is near to his hometown" — low stakes, social context, prompted by familiarity with the place
"She took care of her grandmother because her mother was having backpain" — reactive, prompted by circumstance, routine caregiving
"During my 2nd sem, mtech senior gave me the responsibility of managing AI club website. I have seen that as an opportunity to learn from it so I took the responsibility. First I asked him how to set up" — given the responsibility by someone else, didn't seek it out
"In 6th semester during his internship he took the leadership for a project and guided the other team members. All his teammates need to do the project for that anyone should take the lead, that's what motivated him" — stepped up only because someone had to
"He took all the decisions regarding his education independently. He did not say about any specific incident where he took responsibility" — general statement, no specific incident$rub$,
  $rub$"When she studied in NG — she was the leader to take care of 25 girls for kitchen turn and cleaning turn. Why? She wanted to take responsibility and have solutions for problems" — self-initiated, clear reason given
"Editorial of his dept — his team didn't cooperate well. He decided to do by himself. Communicated well with them, organised the team well to get the job done. Never wanted to do something like this. Became favourite student of HOD" — stepped up despite not wanting to, delivered under pressure
"Masi's son was not into studies. Due to her aunt's complaints, she went and spoke to him. She took classes on zoom call, took tuitions, helped him prepare for 10th board" — self-initiated, specific plan, helped someone outside her immediate responsibility
"Decide to go NG, taking responsibility of education himself. Paid for college fees himself" — significant personal investment, independent decision
"Did a program in Milan foundation, took adolescent session for villagers, helped 20 girls. Planned the program 10 days before" — community level initiative, self-planned
"In NG I served 3 council boards — discipline coordination, help coordination, Training & Placement coordination" — multiple roles simultaneously, sustained
"She was the food coordinator in NG. She helped others there by designing English activities. She was part of Teach for India volunteering, that motivated her" — sustained, intrinsically motivated
"During the hackathon, I led the team of four members, there were clashes between teammates. She managed it really well by motivating the team and solved the clashes between friends" — stepped up in a difficult situation, specific challenge named$rub$,
  $rub$"When I lost my father — our family became financially weak. I took the responsibility to become a person to support my family. Other people were looking down on us and I don't like that — so I promised myself to become successful and help my family and make my mother proud" — profound personal ownership triggered by tragedy, sustained commitment, intrinsic motivation
"When he completed 12th and wanted to go to degree, but family situation didn't allow him. He completed diploma and went to work in the theatre to support family financially. The theatre management disrespected a lot, but still he continued. Only 2 hours of sleep per day. Then he decided to go for degree with help of his father" — extreme personal sacrifice, sustained over time despite humiliation and disrespect
"From childhood he has taken too much responsibility in looking after his family. Father is no more and there was no one to support us" — lifelong ownership from very young age, no choice but to step up, sustained pattern
"I was an English tutor in NG for 25 students. I planned out the curriculum — one topic in one week. First took meeting with them and introduced myself. Wanted to be the voice of others and use my talent to help others. But it was difficult" — self-designed initiative, specific plan, intrinsic motivation, acknowledges difficulty honestly
"After 10th — family was not willing to send her for higher studies. At that she decided to score high marks and took the responsibility of her education by getting scholarship. Had two options — either getting married or take responsibility of her education. Handle it — working hard in 10th to get a good score" — life-defining choice made independently against family pressure, real cost
"When I was in school — my principal complained about me to my parents. I took responsibility to make sure the principal praised me in front of my parents in the same way I got insulted" — personal accountability, turned shame into sustained drive
"In 3rd year in college I wasn't able to afford college, but took responsibility to do freelance to earn money to support myself" — financial ownership, self-initiated, real cost
"From childhood, he has taken too much responsibility. Father had depression when he was in class 8. He bought his laptop on his own and pays the EMI for it as well as his phone. He don't want to depend upon him" — sustained pattern across multiple areas of life, financial ownership from young age
"When one month her father was not having a job she took financial responsibility. Whatever money I got, I gave it to my parents and supported each one of them" — stepped up financially without being asked, immediate response to crisis$rub$,
  $rub$Cannot recall a single specific situation
Goes blank or gives a one-word answer
Only talks about future intent with no past evidence
When probed, still cannot name anything specific$rub$,
  $rub$Acted but only when asked, assigned, or forced by circumstance
Situation is low stakes — college project, trip, routine household task
No real cost involved — time, money, social pressure
Can describe what happened but cannot explain why they stepped up beyond "someone had to"$rub$,
  $rub$Specific situation with real context — names, places, what happened
Stepped up without being directly told to in most cases
Can explain why they took charge — shows genuine self-awareness
Some cost or effort involved — time, discomfort, going beyond what was expected
Delivered a real outcome$rub$,
  $rub$Real, significant cost — financial sacrifice, social pressure, family resistance, physical toll
Sustained over time — not a one-time event, shows a pattern
Intrinsically motivated — did it because they believed in it or had to, not because someone asked
Often against circumstances — stepped up when others didn't or when everything worked against them
Multiple instances across life contexts — family, education, community
Honest about difficulty — doesn't present a perfect hero story$rub$)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  example_1 = EXCLUDED.example_1, example_2 = EXCLUDED.example_2, example_3 = EXCLUDED.example_3, example_4 = EXCLUDED.example_4,
  looking_for_1 = EXCLUDED.looking_for_1, looking_for_2 = EXCLUDED.looking_for_2, looking_for_3 = EXCLUDED.looking_for_3, looking_for_4 = EXCLUDED.looking_for_4,
  updated_at = now();

-- ── Program Alignment (observation criteria live in "what to look for") ───────
INSERT INTO public.interview_rubrics (key, label, ordering, active,
  level_1, level_2, level_3, level_4,
  looking_for_1, looking_for_2, looking_for_3, looking_for_4)
VALUES ('program_alignment', 'Program Alignment', 3, true,
  $rub$Misaligned: Expectations are unrealistic, indifferent between tech and non-tech, has significant parallel commitments that will conflict, or doesn't understand what HVA involves.$rub$,
  $rub$Partially aligned: Some understanding of HVA and tech commitment, but has concerning gaps — unrealistic salary expectations, strong Plan B, parallel commitments that may conflict.$rub$,
  $rub$Mostly aligned: Understands what HVA involves, committed to tech, realistic expectations, minor concerns around parallel commitments or timeline.$rub$,
  $rub$Fully aligned: Clear understanding of HVA's demands, strong tech commitment with specific reasons, realistic expectations, no significant parallel commitments, willing to make tradeoffs.$rub$,
  $rub$Says they're open to non-tech if tech doesn't work — shows tech commitment is conditional
Expects salary significantly above realistic entry level — will reject offers HVA can get them
Has a parallel course or internship that directly conflicts with HVA hours
Doesn't understand what HVA involves beyond "free program with mentors"
Plan B is strong and specific — HVA is just one of many options they're trying simultaneously
Applying for jobs actively right now — won't wait the full program duration$rub$,
  $rub$Committed to tech but for external reasons — salary, family influence — not genuine interest
Understands HVA is a 6-month program but vague on what it actually requires daily
Has parallel commitments that may conflict — another course, internship coming up — but hasn't thought through the impact
Salary expectations are slightly above realistic but not severely inflated
Plan B exists and is somewhat specific — will use it if HVA gets difficult
Job application timeline is unclear — may apply early if pressured$rub$,
  $rub$Committed to tech with a specific reason — curiosity, past experience, genuine interest
Understands what HVA involves from the 14-day challenge — mentions standups, self-learning, intensity
Minor parallel commitments — exams, occasional home travel — but has thought about managing them
Salary expectations are realistic — ₹15,000 to ₹30,000 range for entry level
Plan B is weak — YouTube, self-study — shows HVA is genuinely their best option
Willing to wait at least 4-5 months before applying for jobs$rub$,
  $rub$Strong, specific tech commitment — can articulate exactly why tech and why web development
Deep understanding of HVA's demands — mentions self-learning, daily effort, intensity, not just "free program with mentors"
No significant parallel commitments or has clearly thought through how to manage them
Salary expectations are grounded in reality and connected to specific financial obligations
Plan B is genuinely weak — no realistic alternative, HVA is the only viable path they can see
Clear understanding of job application timeline — willing to wait until they're genuinely ready
Has already made a tradeoff to be here — quit job, turned down another opportunity, reapplied after failing$rub$)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  looking_for_1 = EXCLUDED.looking_for_1, looking_for_2 = EXCLUDED.looking_for_2, looking_for_3 = EXCLUDED.looking_for_3, looking_for_4 = EXCLUDED.looking_for_4,
  updated_at = now();

-- ── Time Commitment (observation criteria live in "what to look for") ─────────
INSERT INTO public.interview_rubrics (key, label, ordering, active,
  level_1, level_2, level_3, level_4,
  looking_for_1, looking_for_2, looking_for_3, looking_for_4)
VALUES ('time_commitment', 'Time Commitment', 4, true,
  $rub$High Risk: Significant blockers that will clearly interrupt consistency — internship, parallel course, frequent travel, unclear schedule, or drastically different hours claimed vs actual schedule.$rub$,
  $rub$Moderate risk: Some manageable blockers but concerning — exam periods with full shutdown, frequent home travel, parallel commitments that partially conflict.$rub$,
  $rub$Low risk: Schedule is mostly clear, minor disruptions anticipated but learner has thought about how to manage them.$rub$,
  $rub$Very low risk: Clear schedule, realistic hours, no significant disruptions anticipated, honest about constraints and has a plan for managing them.$rub$,
  $rub$Claims very high hours — 8 hours every day — with no acknowledgment of any constraint
Schedule described in the interview doesn't match hours claimed in the form
Has an internship starting soon with significant hours that directly conflict with HVA
Doing a parallel course that takes meaningful time every day
Travels home frequently — every weekend or every 2 weeks — with no laptop or internet at home
Cannot describe their daily schedule clearly — vague or contradictory
Exam periods result in complete shutdown of everything else$rub$,
  $rub$Has some free time but schedule is tight — college hours are long, commute is significant
Acknowledges exam periods but says they'll "manage" without a specific plan
Goes home frequently for festivals or family but hasn't thought about internet or laptop availability
Parallel course exists but claims it won't affect HVA — hasn't thought through the overlap
Hours claimed are somewhat realistic but don't account for bad days, exams, or family events
Has a family responsibility — caregiving, household — that takes unpredictable time$rub$,
  $rub$Clear schedule with identifiable free time that matches claimed hours
Acknowledges upcoming disruptions — exams, festivals — and has a rough plan for them
Parallel commitments are minor or ending soon
Travels home occasionally but has laptop and internet access there
During last exam period, managed to continue other commitments partially
Hours claimed are realistic and match what their schedule actually allows$rub$,
  $rub$Very clear daily schedule with specific time blocks identified for HVA
Hours claimed are consistent with form answer and match actual schedule described
Proactively mentions upcoming disruptions and has already thought about how to manage them
No significant parallel commitments — or has already made a plan to drop them
Has laptop and stable internet confirmed
During last exam period, maintained other commitments without fully shutting down
Has already demonstrated consistency during 14-day challenge despite real life constraints$rub$)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  looking_for_1 = EXCLUDED.looking_for_1, looking_for_2 = EXCLUDED.looking_for_2, looking_for_3 = EXCLUDED.looking_for_3, looking_for_4 = EXCLUDED.looking_for_4,
  updated_at = now();

-- ── Articulation (what-it-means only) ────────────────────────────────────────
INSERT INTO public.interview_rubrics (key, label, ordering, active, level_1, level_2, level_3, level_4)
VALUES ('articulation', 'Articulation', 5, true,
  $rub$Cannot Understand: Incomprehensible speech.$rub$,
  $rub$Partly Understands: Comprehensible but lot of grammatical mistakes, poor pronunciation.$rub$,
  $rub$Mostly Understands: Comprehensible but minimal grammatical mistakes, decent pronunciation.$rub$,
  $rub$Fully Understands: Clear communication with negligible grammatical mistakes, good pronunciation.$rub$)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  updated_at = now();

-- ── Comprehension (what-it-means only) ───────────────────────────────────────
INSERT INTO public.interview_rubrics (key, label, ordering, active, level_1, level_2, level_3, level_4)
VALUES ('comprehension', 'Comprehension', 6, true,
  $rub$Does not comprehend: Consistently answers something different from what was asked. No awareness that they've misunderstood.$rub$,
  $rub$Partial comprehension: Understands the surface of the question but misses the intent. Answers part of what was asked.$rub$,
  $rub$Good comprehension: Understands what is being asked and answers it correctly. May occasionally need the question rephrased but gets it on second attempt.$rub$,
  $rub$Strong comprehension: Immediately grasps what is being asked including nuance. Never needs rephrasing. Sometimes anticipates the intent behind the question.$rub$)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, ordering = EXCLUDED.ordering, active = true,
  level_1 = EXCLUDED.level_1, level_2 = EXCLUDED.level_2, level_3 = EXCLUDED.level_3, level_4 = EXCLUDED.level_4,
  updated_at = now();
