import { describe, expect, it } from 'vitest';

import { licenseUrl, repositoryUrl, toBrowsableUrl } from '$lib/config/links';

// The footer's two outward links are derived from package.json rather than
// written out, so what is really under test is that npm's clone URL survives the
// trip into something a browser can open.
describe('toBrowsableUrl', () => {
    it('strips the git+ prefix and the .git suffix', () => {
        expect(
            toBrowsableUrl('git+https://github.com/someone/a-project.git')
        ).toBe('https://github.com/someone/a-project');
    });

    it('leaves an already-browsable URL alone', () => {
        expect(toBrowsableUrl('https://github.com/someone/a-project')).toBe(
            'https://github.com/someone/a-project'
        );
    });

    // A repository whose name genuinely ends in "git" must keep it — only the
    // extension goes, and only from the end.
    it('only strips .git from the end', () => {
        expect(toBrowsableUrl('https://github.com/someone/not.git.here')).toBe(
            'https://github.com/someone/not.git.here'
        );
    });
});

describe('the derived links', () => {
    it('reads the repository straight from package.json', () => {
        expect(repositoryUrl).toBe(
            'https://github.com/mjakinowittering/dyslexicwriter'
        );
    });

    it('points the licence at the file on the default branch', () => {
        expect(licenseUrl).toBe(`${repositoryUrl}/blob/master/LICENSE`);
    });
});
