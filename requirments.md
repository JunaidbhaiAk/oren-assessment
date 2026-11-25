**OREN  ·  SOFTWARE ENGINEER ASSESSMENT**

**Plant data, from entry to approval**

Use any tools you like, AI included (free tiers are enough)

**Why this exercise**

At Oren, a developer takes a loosely defined customer need, decides what the product must do, and ships it in our codebase, mostly with AI tools. This exercise is a small version of that job.

**The customer**

Meera Iyer is Head of Sustainability at Nimbus Cement Ltd, a listed Indian cement maker with nine plants. Every quarter she reports the company's CO2 to her board, and every year her auditor checks it. Today each plant emails her team a spreadsheet every month. The numbers arrive late, nobody can say who checked them, and her team spends days chasing and correcting them.

**Your task**

Build v1 of a feature where plants send their monthly data, Meera's team approves it, and Meera sees the result. Build it inside the starter repo that comes with this brief. The starter is a small app on the same stack as our product. It already has a plant register, a table of emission factors, and examples of what plants send today. Its README explains how to run it.

Page 2 describes the users and the main flows. It does not cover every case. Deciding what else v1 must handle, and what it leaves out, is part of the exercise. If something is unclear, make an assumption, write it down and keep going.

**What to send back**

Reply to this email within 3 days with:

1. A link to your GitHub repo, set to public, with your full commit history. Please do not squash it.  
2. A live link on Vercel that opens without a login. A free Neon database is enough; the starter's README shows how. Keep the starter's user switcher, so that we can act as each user.  
3. A short write-up, about one page, in the repo: what you built, the decisions you made and why, what you left out, and what you would build next. End it with how you used AI: which tools, for what, and one place where the AI was wrong and how you caught it.  
4. The logs of your main AI sessions (the exported chat or agent history, from any tool), attached to your email. Remove secrets such as database passwords first. Do not put the logs in the repo.

**What we look for**

* **Product sense:** v1 handles the cases a real plant team, reviewer and auditor will meet.  
* **Working software:** every flow works on the live link.  
* **Code quality:** code a teammate can pick up and live with.  
* **Confidence:** you know it works, and you can show how.  
* **AI fluency:** AI made you faster, and the judgment stayed yours.

**What happens next**

If we take your application forward, we will set up a call where you walk us through your work.

*Nimbus Cement Ltd and Meera Iyer are fictional. The plant data is invented for this exercise.*

**Users and flows**

**The users**

Each user is a sample login in the starter's user switcher.

* **Plant data owner:** one person at each plant, for example Ravi Meena at Chittorgarh (P01). Sends the plant's monthly data.  
* **Reviewers:** members of Meera's team. They check plant data before it counts.  
* **Meera Iyer, Head of Sustainability:** needs the company picture, plant by plant.

**What a plant reports each month**

How much of each fuel it burned, how much grid power it bought, and how many tonnes of clinker its kiln made. Clinker is what a cement kiln makes, and making it releases most of a cement plant's CO2. The starter's factor table turns each item into CO2. Meera reports direct CO2 (Scope 1\) and CO2 from bought power (Scope 2\) separately.

**Flow 1: Send a month**

* **Who and when:** the plant data owner, after a month ends.  
* **Steps:** opens the month for their plant; enters each item; can save and come back later; submits when done.  
* **End:** the month waits for review, and the data owner can see that it does.

**Flow 2: Review a month**

* **Who and when:** a reviewer, when a plant submits a month.  
* **Steps:** sees what is waiting; opens one plant's month; checks it; approves it, or sends it back with a comment.  
* **End:** an approved month counts in Meera's figures. A month sent back returns to the data owner.

**Flow 3: Fix and resubmit**

* **Who and when:** the plant data owner, when a month comes back.  
* **Steps:** reads the reviewer's comment; corrects the month; submits it again.  
* **End:** the month waits for review again.

**Flow 4: See where things stand**

* **Who and when:** Meera, at any time, for example in the week before a board meeting.  
* **Steps:** sees, for every plant and month, where the data stands; sees approved CO2 by plant and for the company, with Scope 1 and Scope 2 apart.  
* **End:** she knows which figures she can use, and which are not ready yet.

**What matters to the business**

* Meera must never show her board a figure that nobody approved.  
* Her auditor will ask how any figure came to be. She must be able to answer.  
* Plant teams have day jobs. Sending a month should take minutes, not an afternoon.  
* Meera's team is small. Reviewers should spend their time on the figures that need a look.