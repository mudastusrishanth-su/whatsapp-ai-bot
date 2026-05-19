require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/*
====================================
MEMORY STORAGE
====================================
*/

const sessions = {};
const userSessions = {};
const escalationData = {};
const lastIntent = {};
const spamTracker = {};

const analytics = {
  totalMessages: 0,
  totalEscalations: 0,
  loginIssues: 0,
  offerLetterIssues: 0,
  examIssues: 0,
  domainChanges: 0,
  faqReplies: 0,
  spamWarnings: 0,

   resolvedIssues: 0,
  unresolvedIssues: 0,

  ratings: {
    excellent: 0,
    good: 0,
    bad: 0,
  },
};

/*
====================================
CENTRALIZED LINKS
====================================
*/

const LINKS = {
  registration: "https://internships.blackbucks.me",
  taptap: "https://taptap.blackbucks.me",
};
function humanReply(message) {
  /*
AUTO ADD TAPTAP LINK
*/

if (
  message.toLowerCase().includes("taptap") ||
  message.toLowerCase().includes("lms") ||
  message.toLowerCase().includes("lesson plan") ||
  message.toLowerCase().includes("recordings") ||
  message.toLowerCase().includes("dashboard")
) {

  if (!message.includes(LINKS.taptap)) {

    message += `\n\n🔗 TapTap LMS:\n${LINKS.taptap}`;
  }
}
  return message
    .replace("Please share", "Sure 😊 Please share")
    .replace("Please check", "Kindly check")
    .replace("Please don’t worry", "No worries 😊")
    .replace("Please reply", "Just reply")
    .replace(
      "Our support team will verify and assist you",
      "Our support team will help you shortly 😊"
    );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*
====================================
SEND WHATSAPP MESSAGE
====================================
*/

async function sendMessage(to, message) {
    await delay(1200);

  message = humanReply(message);
  const response = await fetch(
    `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },

      body: JSON.stringify({
        messaging_product: "whatsapp",

        to: to,

        text: {
          body: message,
        },
      }),
    }
  );

  const data = await response.json();

  console.log(data);
}

  /*
  ====================================
  HOME ROUTE
  ====================================
  */

  app.get("/", (req, res) => {
    res.send("Blackbucks AI Bot Running 🚀");
  });

  /*
  ====================================
  WEBHOOK VERIFY
  ====================================
  */

  app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    const mode = req.query["hub.mode"];

    const token = req.query["hub.verify_token"];

    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
      console.log("Webhook Verified");

      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  /*
  ====================================
  MAIN WEBHOOK
  ====================================
  */
  const currentDateTime = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "full",
  timeStyle: "short",
});
  app.post("/webhook", async (req, res) => {
    try {
      const body = req.body;

      const message =
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      // Ignore status updates
      if (!message) {
        console.log("Ignoring non-message webhook event");
        return res.sendStatus(200);
      }

      const rawText = message?.text?.body;

      // Ignore text messages without a text body
      if (message.type === "text" && !rawText) {
        console.log("No text body found");
        return res.sendStatus(200);
      }

      const text = rawText ? rawText.toLowerCase().trim() : "";

      console.log("Student:", text);
      analytics.totalMessages++;

      if (
  message &&
  (
    message.type === "text" ||
    message.type === "image" ||
    message.type === "document"
  ) &&
  !message.from_me
) {
        const from = message.from;

        /*
  ====================================
  HANDLE IMAGE ESCALATION
  ====================================
  */

        if (
          (message.type === "image" ||
            message.type === "document") &&
          userSessions[from] === "waiting_for_screenshot"
        ) {
          const teamNumber = process.env.TEAM_WHATSAPP_NUMBER;

          console.log("TEAM NUMBER:", teamNumber);
          console.log("Sending escalation...");

          const issueData = escalationData[from];

          const mediaId =
            message.type === "image"
              ? message.image.id
              : message.document.id;

          const escalationMessage = `🚨 ${issueData.issue.toUpperCase()} ESCALATION

👤 STUDENT DETAILS
━━━━━━━━━━━━━━━

${issueData.details}

⚠️ ISSUE TYPE
━━━━━━━━━━━━━━━

${issueData.issue}

📸 SCREENSHOT / PROOF
━━━━━━━━━━━━━━━

Attached below.

🕒 Escalated At:
${new Date().toLocaleString()}

🤖 Blackbucks AI Support`;
          
          analytics.totalEscalations++;
          await sendMessage(teamNumber, escalationMessage);
          

          await fetch(
            `https://graph.facebook.com/v25.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",

              headers: {
                "Content-Type": "application/json",

                Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              },

              body: JSON.stringify({
                messaging_product: "whatsapp",

                to: teamNumber,

                type: message.type,

                [message.type]: {
                  id: mediaId,
                },
              }),
            }
          );
        
          await sendMessage(
  from,

  `✅ Your issue has been escalated successfully along with screenshot proof.

Our support team will contact you shortly 😊`
);

await delay(2000);

await sendMessage(
  from,

  `⭐ Was the support process helpful so far?

Reply with:
1️⃣ Excellent
2️⃣ Good
3️⃣ Needs Improvement`
);

delete escalationData[from];

userSessions[from] = null;

return res.sendStatus(200);

          delete escalationData[from];


          userSessions[from] = null;

          return res.sendStatus(200);
        }
        /*
        ====================================
        HANDLE TEXT MESSAGE
        ====================================
        */

        /*
        ====================================
        RESET CHAT
        ====================================
        */

        if (text === "reset" || text === "restart") {
          sessions[from] = [];
          userSessions[from] = null;
          delete escalationData[from];

          await sendMessage(
            from,

            `✅ Chat reset successful.

Send Hi to start again 😊`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        GREETING FLOW
        ====================================
        */

        if (
          text === "hi" ||
          text === "hello" ||
          text === "hey" ||
          text === "hii"
        ) {
          userSessions[from] = "waiting_for_query";

          await sendMessage(
            from,

            `👋 Hi, how are you? 😊

I'm the Blackbucks AI Support Assistant.

How can I help you today?`
          );

          return res.sendStatus(200);
        }
        /*
        ====================================
        OFFER LETTER FOLLOW-UP
        ====================================
        */

        if (userSessions[from] === "waiting_offer_letter_confirmation") {
          if (
            text.includes("still not received") ||
            text.includes("not received") ||
            text.includes("didn't receive")
          ) {
            userSessions[from] = "collect_offer_letter_issue";

            escalationData[from] = {
              issue: "Offer Letter Not Received",
            };

            await sendMessage(
              from,

              `Sure 😊 Please share the below details so our support team can verify your payment and assist you faster:

 *Registered Email ID
 *Phone Number 
 *Payment Date & Time

Our support team will verify and assist you 😊`
            );

            return res.sendStatus(200);
          }
        }
        /*
        ====================================
        COLLECT OFFER LETTER DETAILS
        ====================================
        */

        if (userSessions[from] === "collect_offer_letter_issue") {
          escalationData[from].details = text;

          userSessions[from] = "waiting_for_screenshot";

          await sendMessage(
            from,

            `📸 Thank you for sharing the details.

Now please upload:
• payment screenshot
OR
• payment proof 😊`
          );

          return res.sendStatus(200);
        }
        /*
        ====================================
        SPECIAL PAY NOW CONDITION
        ====================================
        */

        if (
          text.includes("pay now") ||
          text.includes("again to pay") ||
          text.includes("pay option") ||
          text.includes("still showing")
        ) {
          await sendMessage(
            from,

            `Please don’t worry 😊

The registration website and the TapTap student dashboard are different platforms.

Your payment has already been updated successfully in the TapTap dashboard, which is why the “Pay Now” option is not visible there. Sometimes, the registration link may still continue showing the “Pay Now” option temporarily due to a sync delay.

Offer letters are usually shared within 24–48 working hours after verification.`
          );

          return res.sendStatus(200);
        }
        /*
        ====================================
        COLLECT LOGIN ISSUE DETAILS
        ====================================
        */

        if (userSessions[from] === "collect_issue_details") {
          escalationData[from].details = text;

          userSessions[from] = "waiting_for_screenshot";

          await sendMessage(
            from,

            `📸 Thank you for sharing your details.

Now please upload:
• screenshot
OR
• screen recording

This helps our support team identify the issue faster 😊`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        COLLECT DOMAIN CHANGE DETAILS
        ====================================
        */

        if (userSessions[from] === "collect_domain_change_details") {
          escalationData[from].details = text;

          userSessions[from] = "waiting_for_screenshot";

          await sendMessage(
            from,

            `📸 Thank you for sharing your details.

Now please upload:
• payment screenshot
OR
• offer letter screenshot 😊`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        COLLECT EXAM ISSUE DETAILS
        ====================================
        */

        if (userSessions[from] === "collect_exam_issue") {
          escalationData[from].details = text;

          userSessions[from] = "waiting_for_screenshot";

          await sendMessage(
            from,

            `📸 Thank you for sharing your details.

Now please upload:
• screenshot
OR
• screen recording of the issue 😊`
          );

          return res.sendStatus(200);
        }
        /*
====================================
SMART INTENT CONTINUATION
====================================
*/

if (
  text.includes("same issue") ||
  text.includes("same problem") ||
  text.includes("still pending") ||
  text.includes("still not working") ||
  text.includes("again") ||
  text.includes("not solved")
) {

  /*
  LOGIN ISSUE CONTINUATION
  */

  if (lastIntent[from] === "LOGIN_ISSUE") {

    userSessions[from] = "collect_issue_details";

    escalationData[from] = {
      issue: "TapTap LMS Login Issue"
    };

    await sendMessage(
      from,

      `I understand 😊 It seems the login issue is still continuing.

Sure 😊 Please share the below details so our support team can help you faster:

1️⃣ Full Name
2️⃣ College Name
3️⃣ Registered Email ID
4️⃣ Roll Number
5️⃣ Registered Phone Number`
    );

    return res.sendStatus(200);
  }

  /*
  OFFER LETTER CONTINUATION
  */

  if (lastIntent[from] === "OFFER_LETTER_ISSUE") {

    userSessions[from] = "collect_offer_letter_issue";

    escalationData[from] = {
      issue: "Offer Letter Not Received"
    };

    await sendMessage(
      from,

      `I understand 😊 It seems you still haven't received the onboarding details.

Sure 😊 Please share the below details so our support team can verify and assist you faster:

1️⃣ Registered Email ID
2️⃣ Payment Date
3️⃣ Payment Screenshot`
    );

    return res.sendStatus(200);
  }

  /*
  DOMAIN CHANGE CONTINUATION
  */

  if (lastIntent[from] === "DOMAIN_CHANGE") {

    userSessions[from] = "collect_domain_change_details";

    escalationData[from] = {
      issue: "Domain Change Request"
    };

    await sendMessage(
      from,

      `Sure 😊 Please share the below details again so our support team can review your domain change request:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Existing Domain
4️⃣ Requested New Domain`
    );

    return res.sendStatus(200);
  }

  /*
  EXAM ISSUE CONTINUATION
  */

  if (lastIntent[from] === "EXAM_ISSUE") {

    userSessions[from] = "collect_exam_issue";

    escalationData[from] = {
      issue: "Test / Exam / Hackathon Issue"
    };

    await sendMessage(
      from,

      `I understand 😊 Please share the below details again so our support team can investigate the issue faster:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Test / Exam Link
4️⃣ Screenshot / Screen Recording`
    );

    return res.sendStatus(200);
  }
}
/*
====================================
ANTI-SPAM / ABUSE HANDLING
====================================
*/

if (!spamTracker[from]) {
  spamTracker[from] = {
    count: 0,
    lastMessage: "",
  };
}

/*
REPEATED MESSAGE SPAM
*/

if (spamTracker[from].lastMessage === text) {
  spamTracker[from].count += 1;
} else {
  spamTracker[from].count = 0;
}

spamTracker[from].lastMessage = text;

/*
SPAM WARNING
*/

if (spamTracker[from].count >= 3) {
  analytics.spamWarnings++;

  await sendMessage(
    from,

    `😊 We understand your concern.

Our support team is already working on your issue. Kindly avoid sending repeated messages so we can assist you smoothly.`
  );

  return res.sendStatus(200);
}

/*
RUDE / ABUSIVE LANGUAGE DETECTION
*/

const abusiveWords = [
  "idiot",
  "stupid",
  "waste",
  "fraud",
  "fake",
  "scam",
  "useless",
  "worst",
  "fool"
];

if (
  abusiveWords.some(word => text.includes(word))
) {

  await sendMessage(
    from,

    `We’re here to help 😊

Kindly avoid using inappropriate language so our support team can assist you better.`
  );

  return res.sendStatus(200);
}
        /*
====================================
AUTO FAQ REPLIES
====================================
*/

if (
  text.includes("class timing") ||
  text.includes("class timings") ||
  text.includes("when are classes")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `📅 Live classes are generally conducted during evening hours after 5 PM.

Weekly schedules and Zoom links are shared in the official WhatsApp group 😊`
  );

  return res.sendStatus(200);
}

if (
  text.includes("recording") ||
  text.includes("recorded session") ||
  text.includes("missed class")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `🎥 Recorded sessions are available inside your lesson plans in TapTap LMS 😊`
  );

  return res.sendStatus(200);
}

if (
  text.includes("attendance")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `✅ Attendance is important for internship completion, assignments, assessments and certificate eligibility 😊`
  );

  return res.sendStatus(200);
}

if (
  text.includes("start date") ||
  text.includes("internship start")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `🚀 Current internship batch starts on 20 May 2026 😊`
  );

  return res.sendStatus(200);
}

if (
  text.includes("taptap") ||
  text.includes("lms link") ||
  text.includes("dashboard link")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `🔗 TapTap LMS:
https://taptap.blackbucks.me 😊`
  );

  return res.sendStatus(200);
}

if (
  text.includes("whatsapp group")
) {
  analytics.faqReplies++;
  await sendMessage(
    from,

    `📢 Official WhatsApp group invitation links are shared through onboarding emails/offer letters 😊`
  );

  return res.sendStatus(200);
}
/*
====================================
FEEDBACK HANDLER
====================================
*/

if (
  text === "1" ||
  text.includes("excellent")
) {

  analytics.ratings.excellent++;

  analytics.resolvedIssues++;

  await sendMessage(
    from,

    `Thank you so much for your feedback 😊`
  );

  return res.sendStatus(200);
}

if (
  text === "2" ||
  text.includes("good")
) {

  analytics.ratings.good++;

  analytics.resolvedIssues++;

  await sendMessage(
    from,

    `Thank you 😊 We're happy to help.`
  );

  return res.sendStatus(200);
}

if (
  text === "3" ||
  text.includes("needs improvement")
) {

  analytics.ratings.bad++;

  analytics.unresolvedIssues++;

  await sendMessage(
    from,

    `Thank you for the feedback 😊

Our support team will continue improving the experience.`
  );

  return res.sendStatus(200);
}
        /*
        ====================================
        AI INTENT DETECTION
        ====================================
        */
        const currentDateTime = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "full",
  timeStyle: "short",
});
        const intentCheck = await groq.chat.completions.create({
          messages: [
            {
              role: "system",

              content: `
Current Date & Time:
${currentDateTime}

Current Internship Batch Start Date:
20 May 2026

You are an AI intent classifier for Blackbucks Support.

Your job is ONLY to identify whether the student needs SUPPORT TEAM ESCALATION.

Reply ONLY with ONE keyword:

LOGIN_ISSUE
PAYMENT_ISSUE
OFFER_LETTER_ISSUE
OFFER_LETTER_MODIFICATION
→ ONLY if student wants:
• name correction
• spelling correction
• college correction
• offer letter modification
• wrong details in offer letter
• update offer letter information
DOMAIN_CHANGE
EXAM_ISSUE
GENERAL_SUPPORT

LOGIN_ISSUE
→ ONLY if student cannot login, dashboard not opening, password issue, access issue, LMS technical issue.

PAYMENT_ISSUE

→ ONLY if:
• payment deducted
• payment failed
• payment pending
• payment verification issue
• dashboard still shows pay now

DO NOT classify offer letter delays or onboarding email delays as PAYMENT_ISSUE.

OFFER_LETTER_ISSUE
→ ONLY if:
• offer letter not received
• onboarding email not received
• no mail after payment
• joining details not received
• internship email pending
• did not receive offer letter
• no mail received
• onboarding email not received
• no internship email
• no WhatsApp group link after payment
• credentials not received
• payment done but no response/email

DOMAIN_CHANGE
→ ONLY if student clearly wants to:

* change domain
* switch internship stream
* change specialization
Domain changes are generally not guaranteed.

The AI should:
• collect student details
• collect proof
• escalate to support team

Never directly approve domain changes.
Never promise domain change confirmation.

EXAM_ISSUE
→ ONLY if:

* exam link not working
* test link issue
* hackathon issue
* assessment technical problem

If students ask about domains, streams, courses or internships available:
- share the official internship domain list
- ask students to register through internships.blackbucks.me
- do NOT ask students to select domains inside the chat

GENERAL_SUPPORT
→ for ALL normal questions including:

* internship details
* domains available
* internship duration
* internship cost
* live classes
* zoom links
* schedules
* recordings
* lesson plans
* resources
* projects
* certificates
* class timings
* course information
* general doubts

IMPORTANT:
If the user is ONLY asking information or doubts,
ALWAYS reply:
GENERAL_SUPPORT

Reply ONLY with the keyword.
No explanation.
`,
            },

            {
              role: "user",
              content: text,
            },
          ],

          model: "llama-3.3-70b-versatile",
        });

        const detectedIntent = intentCheck.choices[0].message.content.trim();

        console.log("Detected Intent:", detectedIntent);
        lastIntent[from] = detectedIntent;

        /*
        ====================================
        LOGIN ISSUE FLOW
        ====================================
        */

        if (detectedIntent === "LOGIN_ISSUE") {
          analytics.loginIssues++;
          userSessions[from] = "collect_issue_details";

          escalationData[from] = {
            issue: "TapTap LMS Login Issue",
          };

          await sendMessage(
            from,

            `Sure 😊 Please share the below details so our support team can help you faster:

1️⃣ Full Name
2️⃣ College Name
3️⃣ Registered Email ID
4️⃣ Roll Number
5️⃣ Registered Phone Number

📸 After sharing details, please upload:
• screenshot
OR
• screen recording of the issue 😊`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        PAYMENT ISSUE FLOW
        ====================================
        */

        if (detectedIntent === "PAYMENT_ISSUE") {
          await sendMessage(
            from,

            `Please don’t worry 😊

Sometimes the dashboard may still show "Pay Now" even after successful payment.

Offer letters are usually shared within 24–48 working hours after verification.`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        OFFER LETTER ISSUE FLOW
        ====================================
        */

        if (detectedIntent === "OFFER_LETTER_ISSUE") {
          analytics.offerLetterIssues++;
          userSessions[from] = "waiting_offer_letter_confirmation";

          await sendMessage(
            from,

            `Please don’t worry 😊

Offer letters, onboarding emails and official WhatsApp group links are usually shared within 24–48 working hours after payment verification.

Please check:
• Inbox
• Spam folder
• Promotions tab

If you still haven’t received any email after 48 working hours, please reply:
still not received`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        DOMAIN CHANGE FLOW
        ====================================
        */

        if (detectedIntent === "DOMAIN_CHANGE") {
          analytics.domainChanges++;
          userSessions[from] = "collect_domain_change_details";

          escalationData[from] = {
            issue: "Domain Change Request",
          };

          await sendMessage(
            from,

            `Sure 😊 Please share the below details for the domain change request so our support team can review it faster:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Existing Domain
5️⃣ New Domain Requested

📸 After sharing details, please upload:
• payment screenshot
OR
• offer letter screenshot 😊`
          );

          return res.sendStatus(200);
        }

        /*
        ====================================
        EXAM ISSUE FLOW
        ====================================
        */

        if (detectedIntent === "EXAM_ISSUE") {
          analytics.examIssues++;
          userSessions[from] = "collect_exam_issue";

          escalationData[from] = {
            issue: "Test / Hackathon / Exam Issue",
          };

          await sendMessage(
            from,

            `Sure 😊 Please share the below details so our support team can help you faster:

1️⃣ Full Name
2️⃣ Registered Email ID
3️⃣ Registered Mobile Number
4️⃣ Roll Number
5️⃣ Test / Exam / Hackathon Link

📸 Also upload:
• screenshot
OR
• screen recording of the issue 😊`
          );

          return res.sendStatus(200);
        }
        /*
        ====================================
        CREATE MEMORY
        ====================================
        */

        if (!sessions[from]) {
          sessions[from] = [];
        }

        sessions[from].push({
          role: "user",
          content: text,
        });

        /*
        ====================================
        MAIN AI RESPONSE
        ====================================
        */

        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",

              content: `
            Current Date & Time:
${currentDateTime}

Current Internship Batch Start Date:
20 May 2026

You are Blackbucks AI Support Assistant.

You are a professional, friendly and human-like internship support executive.

Your job is to help students regarding:
- internships
- TapTap LMS
- offer letters
- classes
- Zoom sessions
- recordings
- assessments
- lesson plans
- certificates
- internship process

If students ask current time or today's date:
- answer in Indian Standard Time (IST)
- answer naturally
- do not mention GMT or UTC

IMPORTANT RULES:
- Always use proper grammar and spelling
- Never claim that you checked internal systems
- Never say verification completed unless explicitly provided
- Never generate fake offer letter status
- Never generate fake student records
- Never pretend to access databases
- If information is unavailable, politely ask the student to contact support
- Keep replies short
- Maximum 3 to 5 lines
- Avoid long explanations
- WhatsApp support style
- Give direct answers
- WhatsApp friendly
- Conversational
- Human-like
- Helpful
- Do NOT sound robotic
- Never generate fake information


TRAINING RULE:
Before collecting escalation details, first understand the exact issue clearly.

Do NOT immediately ask for screenshots or student details.

Ask one short clarification question first if the issue is unclear.

ASSIGNMENTS & ASSESSMENTS RULE:

If students ask about:
- assignments
- assessments
- activities
- tasks
- projects

Reply:
- available in lesson plans inside TapTap LMS
- important updates/links may also be shared in official WhatsApp groups

Keep response short and direct.

CERTIFICATE RULE:

If students ask about certificates:
- mention certificates are provided after successful internship completion
- mention participation, attendance, assignments and assessments are important
- mention certificates may not be issued if minimum participation criteria is not met

Do NOT guarantee certificates automatically.

PAYMENT PORTAL RULE:

Do NOT say TapTap LMS shows payment status.

The registration/payment portal and TapTap LMS are different platforms.

Registration website:
- registration
- payment

TapTap LMS:
- lesson plans
- recordings
- assignments
- assessments
ZOOM LINK RULE:

If students ask for:
- Zoom link
- meeting link
- live class link

Reply:
- Zoom links are shared in official WhatsApp groups before sessions
- ask students to stay connected with the group

Never generate fake Zoom links.

Student:
I have completed payment and received offer letter. What next?

Assistant:Congratulations on completing the payment and receiving the offer letter! 🎉

Next, please check your email inbox, spam folder and promotions tab for the onboarding email from us.

The onboarding email will contain:
• TapTap LMS access details
• official WhatsApp group invitation link
• internship instructions and updates

Please make sure to join the official WhatsApp group, as all important updates, Zoom links, schedules and announcements will be shared there 😊

WHATSAPP GROUP RULE:

Official WhatsApp group invitation links are shared through the offer letter/onboarding email.

All internship updates, schedules and Zoom links are shared only through official WhatsApp groups.

If student cannot join the group:
- first ask them to check email/spam/promotions
- if still not received, collect details and escalate

Do NOT directly generate WhatsApp group links.

LIVE CLASS MISSED RULE:

If students say:
- missed class
- absent today
- could not attend class
- missed live session

Reply briefly:
- recordings available in lesson plan
- stay connected to official WhatsApp group for updates

Do NOT overexplain.

ATTENDANCE RULE:

If students ask about attendance:
- clearly mention attendance is mandatory
- mention assignments, activities and assessments are important
- mention participation may be shared with college faculty/TPO
- mention certificates may not be issued if minimum participation criteria is not met

Do NOT mention exact attendance percentages unless officially defined.

RECORDINGS RULE:

If students ask about:
- recordings
- recorded sessions
- missed classes
- replay videos

Reply:
- recordings are available in lesson plans inside TapTap LMS
- provide LMS link if needed

Keep response short.

LIVE CLASS SCHEDULE RULE:

If students ask:
- class timings
- live class schedule
- when classes happen

Reply:
- classes are generally conducted during evening hours
- usually 2–3 sessions per week
- schedules and Zoom links are shared in official WhatsApp groups

Do NOT invent exact timings unless officially provided.

REGISTRATION RULE:
IMPORTANT PAYMENT RULE:

Do NOT say internships are free.

If students ask about internship fees, payments or enrollment cost:

Reply:
• internship fee/payment details are available on the official registration website
• students can check complete fee details while registering

Registration Website:
https://internships.blackbucks.me

If students ask:
- how to register
- registration process
- how to apply
- internship registration

Reply briefly with:
- registration website
- choose domain
- complete registration
- payment
- onboarding details sent by email

Keep response under 8 lines.
Do NOT overexplain registration steps.

====================================
IMPORTANT INFORMATION
====================================

Registration Website:
https://internships.blackbucks.me

This website is ONLY for:
- internship registration
- internship payment

Student LMS Dashboard:
https://taptap.blackbucks.me

TapTap LMS contains:
- lesson plans
- recordings
- assignments
- assessments
- activities
- study materials

====================================
LIVE CLASSES
====================================

• Live classes are conducted through Zoom
• Weekly schedules are shared every Sunday in official WhatsApp groups
• Zoom links are shared directly in WhatsApp groups before class starts
• Recorded sessions are available in lesson plans
• No live classes on Sunday
• classes are held in the evening after 5 pm
• internships starts 20 may 
• You know the current date and time from the system prompt
• If students ask today's date or current time, answer directly
• Current internship batch starts on 20 May 2026

====================================
PAYMENT INFORMATION
====================================

• Dashboard may still show "Pay Now" after payment
• This is normal sometimes
• Offer letters are shared within 24-48 working hours after verification
• Students should check:
  - Spam folder
  - Promotions tab
  - All Mail section

====================================
LESSON PLAN RULE
====================================

Only share lesson plan links if:
- payment completed
AND
- offer letter received

====================================
REAL SUPPORT EXAMPLES
====================================
Student:
Should I pay any money to enroll in internship?

Assistant:
😊 Internship fee/payment details are available on the official registration website.

Students can check complete fee details and available domains during registration:

https://internships.blackbucks.me

Student:
Is attendance mandatory?

Assistant:
✅ Yes, attendance is mandatory for internship completion.

Students are expected to:
• attend live classes
• complete assignments
• participate in activities
• complete assessments

Regular participation is important for successful internship completion and certificate eligibility and AttNDnce will bE shARED TO THE COLLEGE TPO  😊

Student:
What domains do you provide?

Assistant:
🚀 We currently provide internships in the following domains:

• AI Machine Learning Engineer
• Associate Product Manager
• Cloud Infrastructure & DevOps Engineer
• Cyber Defense & Security Analyst
• Data & Business Intelligence Analyst
• Data Platform Engineer
• Embedded & IoT Systems Engineer
• Generative AI Engineer
• Growth Marketing & CRM Specialist
• Java Full Stack Engineer
• MERN Stack Engineer
• Mobile Software Engineer
• Product UI/UX Designer
• Python Automation Developer
• Quantum Systems Engineer
• Semiconductor Design Engineer

🔗 Students can explore and register through:
https://internships.blackbucks.me

Student:
What courses are available?

Assistant:
📚 Available internship domains:

• AI Machine Learning Engineer
• Associate Product Manager
• Cloud Infrastructure & DevOps Engineer
• Cyber Defense & Security Analyst
• Data & Business Intelligence Analyst
• Data Platform Engineer
• Embedded & IoT Systems Engineer
• Generative AI Engineer
• Growth Marketing & CRM Specialist
• Java Full Stack Engineer
• MERN Stack Engineer
• Mobile Software Engineer
• Product UI/UX Designer
• Python Automation Developer
• Quantum Systems Engineer
• Semiconductor Design Engineer

🔗 Registration Website:
https://internships.blackbucks.me
BAD EXAMPLE:

Student:
Modify my offer letter

Assistant:
I updated your offer letter successfully.

(This is WRONG.)

GOOD EXAMPLE:

Student:
Modify my offer letter

Assistant:
Please contact the support team for offer letter modifications and share:
• registered email ID
• roll number
• correction details
• supporting proof 😊

BAD EXAMPLE:

Student:
Check my offer letter status

Assistant:
I checked the system and your offer letter is verified.

(This is WRONG because the AI has no database access.)

GOOD EXAMPLE:

Student:
Check my offer letter status

Assistant:
Please don’t worry 😊

Offer letters and onboarding emails are usually shared within 24–48 working hours after payment verification.

Please check:
• Inbox
• Spam folder
• Promotions tab

If you still haven’t received any email after 48 working hours, please reply:
still not received

Student:
I missed class

Assistant:
No problem 😊

The recorded session will be available inside your lesson plan in TapTap LMS.

Student:
Where are live classes conducted?

Assistant:
🎥 Live classes are conducted through Zoom.

📅 Weekly schedules are shared every Sunday in your official WhatsApp group.

🔗 Zoom links are shared directly in the WhatsApp group before every session starts.

Student:
in what streams or domains do you provide internships

Assistant:
😊 You can find all available internship domains, streams and complete internship details at:

https://internships.blackbucks.me

Student:
I paid but dashboard still shows pay now

Assistant:
Please don’t worry 😊

Sometimes the dashboard may still show "Pay Now" even after successful payment beacuse registartion link and student dashboard links are diffrent .

Offer letters are usually shared within 24–48 working hours after verification.

Student:
There is no login option

Assistant:
😊 internships.blackbucks.me is only for internship registration & payment.

Your student dashboard is:
https://taptap.blackbucks.me

Student:
Will there be projects involved?

Assistant:
Yes 😊

Students work on assignments, assessments, activities and domain-related practical tasks during the internship.

Student:
I cannot find resources

Assistant:
Please check your lesson plan inside TapTap LMS 😊

All resources including:
• recordings
• assignments
• assessments
• activities
• study materials

will be available there.
`,
            },

            ...sessions[from],
          ],

          model: "llama-3.1-8b-instant",
        });

        const aiReply = completion.choices[0].message.content;

        console.log("AI:", aiReply);

        sessions[from].push({
          role: "assistant",
          content: aiReply,
        });

        if (sessions[from].length > 20) {
          sessions[from] = sessions[from].slice(-20);
        }

        await sendMessage(from, aiReply);

        console.log("Reply Sent ✅");

        console.log("ANALYTICS:", analytics);

        return res.sendStatus(200);
      }

      res.sendStatus(200);
    } catch (error) {
      console.log(error);

      res.sendStatus(500);
    }
  });

  /*
  ====================================
  START SERVER
  ====================================
  */
  
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 AI Server running on port ${PORT}`);
});
