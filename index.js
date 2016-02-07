var _          = require('lodash')
  , request    = require('request')
  , FeedParser = require('feedparser')
  , q          = require('q')
;

module.exports = {
    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {
        var urls        = step.input('url')
          , self        = this
          , connections = []
          , results     = []
        ;

        if(!urls.length) return self.fail('At least one url is required');

        urls.each(function(url) {
            var req = request(url)
              , fp  = new FeedParser()
              , deferred = q.defer()
            ;

            self.log('Processing URL '+url);
            
            req.on('error', function (error) {
                return deferred.reject(error);
            });

            req.on('response', function (res) {
                var stream = this;

                if (res.statusCode != 200) return deferred.reject(new Error('Bad status code '+res.statusCode));

                self.log('URL retrieved');

                stream.pipe(fp);
            });

            fp.on('error', function(error) {
                return deferred.reject(error);
            });

            fp.on('readable', function() {
              // This is where the action is!
              var stream = this
                , meta   = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
                , item
              ;

              while (( item = stream.read() )) {
                results.push({
                    url       : item.link
                    , title   : item.title
                    , summary : item.summary
                    , author  : item.author
                });
              }
            });

            fp.on('end', function() {
                deferred.resolve();
            });

            connections.push(deferred.promise);
        });

        q.all(connections)
            .then(this.complete.bind(this,results))
            .catch(this.fail.bind(this))
        ;
    }
};
