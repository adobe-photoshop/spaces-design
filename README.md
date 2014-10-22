Playground Design
=================

Setup
-----------------

First:

1. If you're inside a corporate firewall that disallows `git://` URLs, see the notes below and act accordingly.
2. Download and install [Bower](http://bower.io/).
3. Clone this repo: `git clone https://github.com/adobe-photoshop/playground-design.git`.
4. In the root directory of the cloned repo, run `bower install`.

Next, if you want to run the linter or tests from the command line:

1. Download and install [Node](http://nodejs.org/).
2. Install grunt-cli using NPM: `npm install -g grunt-cli`.
3. Run `npm install` from the root of this repo.

Finally, add the following to your `~/.bash_profile`, and then log out and back in: 
```
launchctl setenv PG_STARTUPURL file:///Users/yourname/some-path/playground-design/src/index.html
launchctl setenv PG_CACHE_PATH /some-path/tmp/playground
```
The URL in the first line should point to your cloned playground-design repo, and the path in the second line should point to a temporary directory.

Directories
-----------

1. Put JavaScript source files in `src/js/`.
2. Put HTML/Mustache templates in `src/html/`. (Don't add to `index.html` directly.)
3. Put CSS files in `src/style/`.
4. Put images in `src/img/`.
5. Add tests to modules in `test/specs/` and update the specs classes in `test/specs.js` accordingly.

Compilation
-----------
To produce an optimized build, run `grunt build`. The resulting files are generated in the `build/` subdirectory, including concatenated and minified JavaScript files, and a CSS file compiled from the LESS source files. 

Coding Conventions
------------------

All code must follow the [coding conventions](https://github.com/adobe-photoshop/playground-design/wiki/Coding-Conventions), and must pass [JSHint](http://www.jshint.com/) and [JSCS](https://github.com/jscs-dev/node-jscs).

JSHint and JSCS can be run on all JavaScript source in the project by running `grunt test`. 

Notes
-----

### git/bower behind firewalls

To make bower work in places where `git://` URLs don't work (e.g. inside a corporate firewall), run this git command:

```bash
git config --global url."https://".insteadOf git://
```

To undo that after you've quit your job at a large corporate institution, run:

```bash
git config --global --unset url."https://".insteadOf
```

### Github authentication without SSH
A side effect of using git over HTTPS instead of SSH (as with `git://` URLS) is that, by default, you will be asked to enter your Github password before every command that requires authentication. Luckily, git can be configured to cache your credentials in memory, as described [here](https://help.github.com/articles/caching-your-github-password-in-git/).
