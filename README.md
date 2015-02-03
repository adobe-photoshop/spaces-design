Playground Design
=================

Setup
-----

***Note:*** If you're inside a corporate firewall that disallows `git://` URLs, see the notes below to resolve the issue, otherwise tools like `bower` will fail.

1. Sync `//photoshop/workarea/playground/...` to your development machine.
2. Download and install [`bower`](http://bower.io/).
3. Clone this repo: `git clone https://github.com/adobe-photoshop/playground-design.git`.
4. In the root of your `playground-design` repo, run `bower install`.

Next, do the following if you want to run the linter or tests from the command line. If you're a dev, this is nonoptional:

1. [Download and install](http://nodejs.org/download/) Node.
2. Install grunt-cli using NPM: `npm install -g grunt-cli`.
3. In the root of your `playground-design` repo, run `npm install`.

Development
-----------

Once setup is complete:

1. Build the Photoshop application
2. (Currently) Build the platform-appropriate project in `//photoshop/workarea/playground/plugins/playground`
3. From a command line, `cd` to the Perforce `//photoshop/workarea/playground` directory
4. Run `./plugins/playground/tools/osx_build_and_go.sh`. You should only have to call this when CEF changes (or e.g., after a sync from main).
5. Launch `playground`'s Photoshop.
6. In Photoshop's preferences: Experimental Features. Enable Designshop.
7. Relaunch Photoshop.
8. After reboot there should be an iconic `->Ds` button at the bottom of the Photoshop tool bar panel. Click it.
9. Congratulations, you're in Playground.
    1. `File->New` should get you a default document, and you're on your way.
    2. Photoshop should launch directly into Designshop hereafter.
10. In a browser window, visit http://localhost:9234/ to see inspector tools for the Playground browser instance's contents.

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

To produce an optimized build, in the root of your `playground-design` repo run `grunt build`. The resulting files are generated in the `build/` subdirectory, including concatenated and minified JavaScript files, and a CSS file compiled from the LESS source files. 

Documentation
--------------------------

 - [Architecture Overview](https://github.com/adobe-photoshop/playground-design/wiki/Designshop-Architecture)
 - [React Tutorial](http://facebook.github.io/react/docs/tutorial.html)

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
