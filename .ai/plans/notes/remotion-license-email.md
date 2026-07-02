# Draft e-mail → hi@remotion.dev

> Status: v2 (2026-07-02) — rewritten in Michal's voice + narrowed to the 3 questions
> the license-text research couldn't settle from the T&C alone.
> Send from: michal.dovrtel@studyfi.com

---

**Subject:** Free design tool bundling Remotion. Four license questions

Hi Remotion team,

I'm Michal and I build things. My current thing is Maude (https://github.com/1aGh/maude), a free, MIT-licensed design tool for Claude Code. Local dev server, React/TSX design canvases, no telemetry, no signup. I build it mostly at night, solo, and I sell nothing.

I want to build its video layer on Remotion. Honestly, nothing else comes close for AI-authored comps, and your LLM docs are a big reason. Before I ship anything I want to be sure I read the license right. (I did read it. Twice.)

The setup:

- I'd bundle `remotion`, `@remotion/player` and `@remotion/transitions` as pre-built, minified JS inside my npm package. My users never run npm install, that's kind of the whole point of the tool. Your LICENSE.md ships next to the bundles and my docs say clearly it's your license, not MIT.
- Claude generates the compositions as TSX in the user's own project. The user previews and scrubs them in the embedded Player, locally.
- The tool ships a small in-app timeline editor I'm building myself on top of the Player (scrub, playhead, retiming sequences), following your building-a-timeline guide. To be clear: no embedded Remotion Studio, and no code from the Editor Starter (I know it has its own license). Users edit compositions through this UI and through Claude, and every edit just rewrites the TSX in their project.
- MP4/GIF export is my own pipeline (frame-stepping the Player in a local Chromium, then WebCodecs encode). No `@remotion/renderer`, no `@remotion/web-renderer`, no cloud. I'm not trying to route around anything, I just don't want to ship native binaries. Happy to switch to the official renderer if you'd rather see that.
- In-app notice + docs telling users: free for individuals and companies up to 3 people, companies of 4+ need their own license from remotion.pro.

From LICENSE.md and the terms my understanding is: the license attaches to whoever owns and controls the Remotion code (my users, since the comps live in their projects), not to me as the redistributor. And AI-generated code that users then edit is explicitly on the acceptable side. Four things I couldn't answer from the text:

1. Is redistributing Remotion pre-bundled and minified inside a free tool OK? Nothing is sold, so the "selling a derivate" clause reads like it doesn't apply. But pre-bundling isn't addressed anywhere and I'd rather ask than guess.
2. Am I, as the solo author of the free tool itself, an "Automator" because the tool embeds the Player and ships that timeline editor? My read is no. The tool is free, everything runs locally, I host nothing and serve no content. As an individual I'd fall under the Free License. But "video editors" and "companies launching applications" are close enough to what I'm building that I'd like to hear it from you.
3. A company of 4+ people using Maude to make videos for themselves: that's Creators, right? The terms say Player embedding counts as automation when it's "on a website to dynamically display compositions". Maude's Player is a local design preview on the user's own machine, so I read that as Creators scope, not Automators. Correct?
4. Is there any attribution or notice text you'd like a tool like this to show at export time?

Thanks for building Remotion, and for the system-prompt and llms.txt work especially. I'd rather set this up right from day one.

Michal
https://github.com/1aGh/maude
