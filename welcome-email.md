# Firewalkers Welcome Email
## Set this up in SendFox: Automations → Welcome Email

---

**Subject line:** Welcome to the fire 🔥

---

Hello [first_name],

Welcome to the Firewalkers.

You're here because something in the conversation about technology, land, AI and the future isn't sitting right with you. Something about the pace of it. The scale of it. The unasked questions.

You're in the right place.

---

**What the Firewalkers are**

We are not anti-AI. We use AI — including to protect the very things we're concerned about. We are not anti-progress. We believe in science, engineering, and human creativity.

What we question is waste. Short-term thinking. Speculative development that consumes landscapes, water, energy and communities on the assumption that the returns will justify the cost.

We believe innovation and stewardship belong together. The future requires both.

---

**Three things to do right now**

**1. Read the founding posts**

Start with *[A Fire in the Distance](https://heartofscott.github.io/posts/fire-in-the-distance.html)* — the post that explains why this movement exists and what it is trying to do.

Then *[We Are Not Anti-AI. We Are Pro-Wisdom.](https://heartofscott.github.io/posts/pro-wisdom.html)* — which addresses the question everyone asks.

And *[You Might Be a Firewalker](https://heartofscott.github.io/posts/you-might-be-a-firewalker.html)* — which might describe exactly why you signed up.

**2. Try the AI Prompt Library**

The [Good AI page](https://heartofscott.github.io/good-ai.html) has eight free prompts you can paste into any AI assistant — Claude, ChatGPT, Gemini — to analyse planning documents, draft objection letters, understand your rights, and build evidence for campaigns.

Try one. Even if you don't have a campaign in mind right now, it is worth knowing what is possible.

**3. Bring something to the hearth**

If you have a local story, a campaign, a piece of research, a question, a letter you have written — [submit it](https://heartofscott.github.io/#submit). The movement is built from what people bring to it.

---

**What you'll receive from us**

When there is something worth saying — a new post, a campaign update, an event, a resource worth sharing — you will hear from us.

We will not fill your inbox with noise. The fire burns steadily, not frantically.

---

Thank you for being here.

The future still belongs to the stewards. We are glad you are one of them.

*Blaze*
*Keeper of the Hearth · The Firewalkers*

[heartofscott.github.io](https://heartofscott.github.io)

---

*You are receiving this because you signed up at heartofscott.github.io. You can unsubscribe at any time.*

---

## How to set this up in SendFox

1. Log into **sendfox.com**
2. Go to **Automations** (left sidebar)
3. Click **Create Automation**
4. Select **Welcome Email** (triggers when someone subscribes)
5. Set the **delay** to immediate (0 hours) or 10 minutes
6. Paste the subject line and email body above
7. Replace `[first_name]` with SendFox's merge tag: `{{ subscriber.first_name }}`
8. Add a plain-text version (just the text, no formatting)
9. Test it by subscribing with a test email address
10. Activate the automation

**The merge tag for first name in SendFox is:** `{{ subscriber.first_name }}`

So the opening becomes: `Hello {{ subscriber.first_name }},`
