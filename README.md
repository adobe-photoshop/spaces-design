Spaces Design
=================

Setup
-----

***Note:*** If you're inside a corporate firewall that disallows `git://` URLs, see the notes below to resolve the issue, otherwise tools like `bower` will fail.

1. Sync `//photoshop/workarea/playground/...` to your development machine.
2. Download and install [`bower`](http://bower.io/).
3. Clone this repo: `git clone https://github.com/adobe-photoshop/spaces-design.git`.
4. Copy the fonts from `//photoshop/workarea/playground/plugins/playground/www/src/font/` into `src/font/` (see README in `src/font/` for more details).
5. In the root of your `spaces-design` repo, run `bower install`.

Next, do the following if you want to run the linter or tests from the command line. If you're a dev, this is nonoptional:

1. [Download and install](http://nodejs.org/download/) Node.
2. Install grunt-cli using NPM: `npm install -g grunt-cli`.
3. In the root of your `spaces-design` repo, run `npm install`.

Development
-----------

Once setup is complete:

1. Build the Photoshop application
2. (Currently) Build the platform-appropriate project in `//photoshop/workarea/playground/plugins/spaces`
3. From a command line, `cd` to the Perforce `//photoshop/workarea/playground` directory
4. Run `./plugins/spaces/tools/osx_build_and_go.sh`. You should only have to call this when CEF changes (or e.g., after a sync from main).
5. Launch `spaces`'s Photoshop.
6. In Photoshop's preferences: Experimental Features. Enable Designshop.
7. Relaunch Photoshop.
8. After reboot there should be an iconic `->Ds` button at the bottom of the Photoshop tool bar panel. Click it.
9. Congratulations, you're in Spaces.
    1. `File->New` should get you a default document, and you're on your way.
    2. Photoshop should launch directly into Designshop hereafter.
10. In a browser window, visit http://localhost:9234/ to see inspector tools for the Spaces browser instance's contents.

Directories
-----------

_Dependencies_:

1. Modules managed by `bower` will be in `bower_components`.
2. Modules managed by `npm` will be in `node_modules`. 

_Sources_:

1. Put JavaScript files in `src/js/`.
    1. UI code is in `src/js/jsx`. `Main.jsx` is the top-level UI file.
2. Put CSS (Less) files in `src/style/`.
3. Put images in `src/img/`.

_Testing_:

1. Add tests to modules in `test/specs/`.
    1. Update the specs classes in `test/specs.js` accordingly.

Compilation
-----------

***Note:*** If you're developing, you probably _don't_ want to perform a compilation step. A compiled version disables a lot of logging and profiling and such.

To produce an optimized build, in the root of your `spaces-design` repo run `grunt build`. The resulting files are generated in the `build/` subdirectory, including concatenated and minified JavaScript files, and a CSS file compiled from the LESS source files. 

Documentation
--------------------------

 - [Architecture Overview](https://github.com/adobe-photoshop/spaces-design/wiki/Design-Space-Architecture)
 - [React Tutorial](http://facebook.github.io/react/docs/tutorial.html)

Coding Conventions
------------------

All code must follow the [coding conventions](https://github.com/adobe-photoshop/spaces-design/wiki/Coding-Conventions), and must pass [JSHint](http://www.jshint.com/) and [JSCS](https://github.com/jscs-dev/node-jscs).

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

LICENSE
-------

(MIT License)

Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 
Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the 
Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
DEALINGS IN THE SOFTWARE.

**Please see the [LICENSE](https://github.com/adobe-photoshop/spaces-design/blob/master/LICENSE) file at the root of the repository for licensing details on third-party code**

Third-Party Code
----------------

A list of third-party code used by this project is available at https://github.com/adobe-photoshop/spaces-design/wiki/Third-party-code
