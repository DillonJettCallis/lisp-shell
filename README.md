# A lisp based shell language

This is a language designed to create a new shell languages that maintains the tersness of a typical shell with the more powerful programming features of a full language.

To achieve this, we use a lisp that acts like a shell. 

Variables are marked by a $ prefix, everything else besides brackets and numbers are implicitly strings. The begining fuction of a sExpression can omit the $,
and if no value is found it is then assumed to be a standard shell command, the arguments will be stringified and passed to it. 

Examples will help, imagine this in your shell:


This does exactly what you would expect, nothing unusual

`git branch`

However you can instead define a function. This function is named $fork and takes one argument, $name. It will then call `git checkout -b` passing in the name with "feature/" prepended to it.

`defn $fork [$name] (git checkout -b "feature/$name")`

Use this function like so:

`fork test`

And this will be identical in action to doing:

`git checkout -b feature/test`


