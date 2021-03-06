var cluster = require( 'cluster' );
var numCPUs = require( 'os' ).cpus().length;
var conf = require( '../conf' ).server;
var spawn = require( 'child_process' ).spawn;

var deepstreamConfig = conf.deepstreams;
var completedDeepStreams = 0;
var maxDeepstreams = deepstreamConfig.length;

var deepstream;
var performanceUsage;

if( cluster.isMaster ) {
	console.log( 'Running deepstream cluster with ' + maxDeepstreams + ' nodes on machine with ' + numCPUs + ' cores' );

	for( var i = 0; i < numCPUs && i < maxDeepstreams; i++ ) {
		setTimeout( startDeepstream( deepstreamConfig[ i ] ), conf.spawningSpeed * i );
	}

	cluster.on( 'online', onDeepstreamOnline );
	cluster.on( 'exit', onDeepstreamExited );
} else {
	deepstream = require( './server' )( onDeepstreamStarted );
	if( conf.totalTestTime !== -1 ) {
		setTimeout( function() {
			deepstream.stop();
			process.exit();
		}, conf.totalTestTime );
	}
}

function startDeepstream( port ) {
	return function() {
		cluster.fork( {
			PORT: port
		} );
	}
}

function onDeepstreamStarted( port ) {
	console.log( 'deepstream with PID:' + process.pid + ' listening on port ' + port );
}

function onDeepstreamOnline( worker ) {
	var pid = worker.process.pid;
	console.log( 'deepstream spawned with PID:' + pid );
	performanceUsage = spawn( 'bash' );
	performanceUsage.stdin.write( 'rm -rf stats && mkdir stats\n' );
	//Using top
	performanceUsage.stdin.write( 'top -p ' + pid + ' -b -d 1 > stats/' + pid + '.txt &\n' );
}

function onDeepstreamExited( worker, code, signal ) {
	if( signal ) {
		console.log( "Worker was killed by signal: " + signal );
	} else if( code !== 0 ) {
		console.log( "Worker exited with error code: " + code );
	}
	completedDeepStreams++;
	if( completedDeepStreams === numCPUs || completedDeepStreams === maxDeepstreams ) {
		console.log( 'Server Performance Tests Finished' );
	}
	performanceUsage.stdin.end();
}

function validateConfig() {
	if( !maxDeepstreams ) {
		throw 'No array of deepstream ports provided';
	}
	if( maxDeepstreams > numCPUs ) {
		console.warn( 'Attempting to run ' + maxDeepstreams + ' deepstream instances on a ' + numCPUs + ' cpu machine' );
	}
}
