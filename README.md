# App legal

Privacy policies and legal pages for the iOS apps, served as static HTML so each policy has a
stable public URL an App Store listing can point at.

## What is here

| Path | What it is |
|---|---|
| `hisword/` | Privacy policy for the His Word app |
| `scholarme/` | Privacy policy for the ScholarMe app |
| `data/` | The policy content the pages render from |
| `design/` | Shared styling for the pages |
| `discover/` | App Store discovery material |
| `previews/` | Screenshots used in listings |

## Publishing

The site is static. Any static host serves it as-is, and `index.html` at the root links to each
app's policy. Edit the policy text in `data/`, then redeploy.

## Why it is a separate repo

App Store review wants a policy URL that does not move. Keeping the policies in their own repo
means a policy update never touches the app source, and the URL stays the same across releases.

## License

The policy text is not licensed for reuse. It describes these specific apps.
