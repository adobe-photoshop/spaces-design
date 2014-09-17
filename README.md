Playground Design
=================

Development Setup
-----------------

1. Install [Node](http://nodejs.org/)
2. Install [Bower](http://bower.io/)
3. If you're inside a corporate firewall that disallows `git://` URLs, see the note below and act accordingly
4. Clone this repo
5. In the root directory of this repo, run `bower install`
6. Optional: If you want to run tests and jshint from the command line:
   a. Install grunt-cli with `npm install -g grunt-cli`
   b. Run `npm install` from the root of this repo

Directories
-----------

1. Put JavaScript source files in `src/js/`.
2. Put HTML/Mustache templates in `src/html/`. (Don't add to `index.html` directly.)
3. Put CSS files in `src/style/`.
4. Put images in `src/img/`.
5. Add tests to modules in `test/specs/` and update the specs classes in `test/specs.js` accordingly.

Coding Conventions
------------------

All code must follow the [coding conventions](https://github.com/adobe-photoshop/playground-design/wiki/Coding-Conventions) and pass [JSHint](http://www.jshint.com/).

JSHint and JSCS can be run on all JavaScript source in the project by running `grunt test`. See the optional development setup steps for information on how to install grunt.

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
