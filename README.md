# petit-chat

A small animated braille cat above the Claude Code prompt. The cat blinks, moves its tail and turns its head, then rests for 5 to 20 seconds.

## Install

Type this line at the prompt of a Claude Code terminal session:

```
/plugin install petit-chat --marketplace Aler1x/claude-cat
```

Then type `y` to add the marketplace and select a scope.

## Develop

```bash
claude --plugin-dir .
```

```bash
claude plugin test .
```

## Credits

This is a port of `PetitChat` from [mistral-vibe](https://github.com/mistralai/mistral-vibe) (`vibe/cli/textual_ui/widgets/banner/petit_chat.py`), licensed under Apache-2.0. See [LICENSE](LICENSE).
