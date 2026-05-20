package logger

import (
	"log"
	"os"
)

type Logger struct {
	info  *log.Logger
	warn  *log.Logger
	error *log.Logger
	debug *log.Logger
}

var defaultLogger *Logger

func init() {
	defaultLogger = New()
}

func New() *Logger {
	return &Logger{
		info:  log.New(os.Stdout, "[INFO] ", log.LstdFlags|log.Lshortfile),
		warn:  log.New(os.Stdout, "[WARN] ", log.LstdFlags|log.Lshortfile),
		error: log.New(os.Stderr, "[ERROR] ", log.LstdFlags|log.Lshortfile),
		debug: log.New(os.Stdout, "[DEBUG] ", log.LstdFlags|log.Lshortfile),
	}
}

func Info(v ...interface{}) {
	defaultLogger.info.Println(v...)
}

func Infof(format string, v ...interface{}) {
	defaultLogger.info.Printf(format, v...)
}

func Warn(v ...interface{}) {
	defaultLogger.warn.Println(v...)
}

func Warnf(format string, v ...interface{}) {
	defaultLogger.warn.Printf(format, v...)
}

func Error(v ...interface{}) {
	defaultLogger.error.Println(v...)
}

func Errorf(format string, v ...interface{}) {
	defaultLogger.error.Printf(format, v...)
}

func Debug(v ...interface{}) {
	defaultLogger.debug.Println(v...)
}

func Debugf(format string, v ...interface{}) {
	defaultLogger.debug.Printf(format, v...)
}

func Fatal(v ...interface{}) {
	defaultLogger.error.Fatal(v...)
}

func Fatalf(format string, v ...interface{}) {
	defaultLogger.error.Fatalf(format, v...)
}
