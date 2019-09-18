var os = require('os');
var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');


var NUnitReporter = function (baseReporterDecorator, config, logger, helper, formatError) {
  var log = logger.create('reporter.nunit');
  var reporterConfig = config.nunitReporter || {};
  var pkgName = reporterConfig.suite || '';
  var outputFile = helper.normalizeWinPath(path.resolve(config.basePath, reporterConfig.outputFile
    || 'test-results.xml'));

  var xml;
  var pendingFileWritings = 0;
  var fileWritingFinished = function () { };
  var allMessages = [];
  var totalSuccess = 0;
  var totalFailures = 0;
  var totalSkipped = 0;
  var suiteList = {};

  baseReporterDecorator(this);

  this.adapters = [function (msg) {
    allMessages.push(msg);
  }];

  var initliazeXmlForBrowser = function (browser) { };

  this.onRunStart = function (browsers) {
    suites = Object.create(null);
    results = Object.create(null);
    xml = builder.create('test-results');

    xml.att('name', "Karma Results")

    var d = new Date();
    var date = d.toISOString().substr(0, 10);
    var time = d.toISOString().substr(11, 8);
    xml.att('date', date);
    xml.att('time', time);

    // required attr we don't have data for
    xml.att('invalid', 0);
    xml.att('ignored', 0);
    xml.att('inconclusive', 0);
    xml.att('not-run', 0);
    xml.att('errors', 0);

    xml.ele('environment', {
      'nunit-version': 'na', 'clr-version': 'na', 'os-version': os.release(),
      platform: os.platform(), cwd: config.basePath, user: 'na', 'user-domain': 'na',
      'machine-name': os.hostname()
    });

    xml.ele('culture-info', { 'current-culture': 'na', 'current-uiculture': 'na' });

    // TODO(vojta): remove once we don't care about Karma 0.10
    browsers.forEach(initliazeXmlForBrowser);
  };

  this.onBrowserStart = function (browser) {
    initliazeXmlForBrowser(browser);


  };

  this.onBrowserComplete = function (browser) {
    xml.att('total', totalSuccess);
    xml.att('failures', totalFailures);
    xml.att('skipped', totalSkipped);
  };

  this.onRunComplete = function () {
    var xmlToOutput = xml;

    pendingFileWritings++;
    helper.mkdirIfNotExists(path.dirname(outputFile), function () {
      fs.writeFile(outputFile, xmlToOutput.end({ pretty: true }), function (err) {
        if (err) {
          log.warn('Cannot write NUnit xml\n\t' + err.message);
        } else {
          log.debug('NUnit results written to "%s".', outputFile);
        }

        if (!--pendingFileWritings) {
          fileWritingFinished();
        }
      });
    });

    suites = xml = null;
    allMessages.length = 0;
  };

  this.specSuccess = this.specSkipped = this.specFailure = function (browser, result) {
    var suiteName = (pkgName ? pkgName + ' ' : '') + result.suite.join(' ').replace(/\./g, '_');
    var suiteResults;
    
    if (!suiteList[suiteName]) {
      // console.log(xml);
      var testSuite = xml.ele('test-suite', {
        name: suiteName
      });
      // thing.att('name', result.description);
      testSuite.att('result', (result.failed) ? 'Failure' : 'Success');
      testSuite.att('executed', !result.skipped);
      testSuite.att('type', 'TestSuite');
      
      var suite = testSuite.ele('test-suite', {
        name: suiteName
      });
      suite.att('type', 'TestFixture');
      suite.att('executed', !result.skipped);
      suite.att('result', (result.failed) ? 'Failure' : 'Success');
      suiteResults = suite.ele('results');
      suiteList[suiteName] = suite;
      // console.log(suite)
      // console.log('------------');
    } else {
      suiteResults = suiteList[suiteName].children[0];
    }

    var testTime = ((result.time || 0) / 1000);
    var spec = suiteResults.ele('test-case', {
      name: result.description, 
      time: testTime,
      description: (pkgName ? pkgName + ' ' : '') + browser.name + '.' + result.suite.join(' ').replace(/\./g, '_'),
      executed: result.skipped ? 'False' : 'True',
      success: (result.success || result.skipped) ? 'True' : 'False', // Skipped tests are successful
      result: (result.success || result.skipped) ? 'Success' : 'Failure'
    });

    if (result.skipped) {
      totalSkipped++;
    } else if (result.success) {
      totalSuccess++;
    }

    if (!result.success && !result.skipped) {
      suiteList[suiteName].attributes.result = 'Failure';
      var failure = spec.ele('failure')
      failure.ele('message').dat(result.log);
      failure.ele('stack-trace').dat(result.suite + ' ' + result.description);
      totalFailures++;

    }
  };

  // wait for writing all the xml files, before exiting
  this.onExit = function (done) {
    if (pendingFileWritings) {
      fileWritingFinished = done;
    } else {
      done();
    }
  };
};

NUnitReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
  'reporter:nunit': ['type', NUnitReporter]
};
