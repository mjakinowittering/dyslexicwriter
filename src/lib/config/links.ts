// The outward-facing links the footer shows, derived from package.json rather
// than written out twice. `resolveJsonModule` is on, and Vite gives the JSON
// named exports, so only the field below is pulled into the bundle.
//
// `homepage` is deliberately not read. It points at the deployed app, which is
// where the footer is already being rendered — a link back to itself.
import { author, repository } from '../../../package.json';

// npm's repository URL is a clone URL, not a browsable one: it carries a `git+`
// scheme prefix and a `.git` suffix, and GitHub redirects rather than 404s on
// those, which is a redirect the user's browser doesn't need to take.
export function toBrowsableUrl(url: string): string {
    return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

export const repositoryUrl: string = toBrowsableUrl(repository.url);

// `master` rather than `develop`: the licence should read the same to a visitor
// as it does to whoever is mid-branch here.
export const licenseUrl: string = `${repositoryUrl}/blob/master/LICENSE`;

export const authorUrl: string = author.url;

// The one URL with no home in package.json: OpenDyslexic is thanked in the
// footer as a project, not depended on as this package's own metadata.
export const openDyslexicUrl = 'https://opendyslexic.org/';
