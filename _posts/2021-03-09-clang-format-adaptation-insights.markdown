---
layout: post
title:  "Clang Format adaptation insights"
date:   2021-03-09 20:00:00 +0100
categories: 
 - clang-format 
 - c++ 
---
Every programmer cultivates their own code layout. The style of this layout is very personal. If you're a programmer you know what I mean, everyone has their own preferences on how to write down code. And everyone has their own opinion on what's "nice to look at". What's interesting is that almost everyone thinks their style isn't strange or special in any way. But when you start to compare it to others, chances are that you'll find someone with a wildly different style. And you can't both be right.

At your workplace you've most likely had discussions about code layout. Unless you really don't care, but then you would be an exceptional case. I definitely care about layout. When I just started out with C++ I always put the newline after the braces like this:
{% highlight cpp%}
if(condition){
    DoSomething();
}
{% endhighlight %} 
But then I got a group assignment, and all 4 other people thought it was weird. So I changed my style:
{% highlight cpp%}
if(condition)
{
    DoSomething();
}
{% endhighlight %} 
After the assignment was done something very interesting happened. I kept the new style, because my old style looked kind of weird now.

Fast forward to now, where I work in a team consisting of many more people on a codebase where you could encounter code that is over 20 years old. There is now a whole spectrum of code layout styles. Among the team that I work in, and within the code that we work on, the difference between the style on one end of the spectrum and the other end is spectacularly different. C++ gives you all the freedom you could want for code layout. But this is often more a curse then a blessing.

My team members are very motivated and are always looking for ways to improve the development process. For some time we've been doing code reviews, and we've been working more towards sharing knowledge about components. The goal of sharing knowledge is being able to take on issues from someone else to better meet sprint goals.

We had an explicit rule that the existing layout of the code you work on must remain intact. New code may be done in your own style. A fair and reasonable rule. But leaving someone else's layout intact is time consuming, because it's not the layout that you routinely use. Also, automated refactoring (rename function, change signature, extract function) only applies your own editor's layout, if that. So sometimes you'd have to manually layout the generated code.

During code review, your layout efforts, among other things, will be checked. Usually the reviewer does not know how much effort it actually took and will make a comment: "This declaration is not aligned 🙂" 

This did not go unnoticed in our self-improving team, in summary:
* Changing between layouts is time consuming
* Essential code refactoring tools do not play nice with layout
* Discussions about code layout during review is time consuming

# Enter Clang-format

When you think about automatic C++ code layout you think about clang-format. This tool parses a source file like how a compiler would parse it, and applies layout rules which are defined in a configuration file. 

After I brought this up I was told this wasn't the first time this idea was pitched. Before I even started working at the company there was talk about clang-format. And only talk it has remained, because it was too difficult to determine what rules would be configured. Big surprise there /s. I heard that there used to be lengthy discussions and voting rounds. This caused the idea to lose traction.

But things are different now, as mentioned before, the development process has matured to a certain point. I understood that back then there were no code reviews. Most developers had their own component to work on. Clang-format would solve more problems now than it would have back then.

But how do you convince a team to agree upon a certain layout?

I did not like the idea of having voting rounds. Clang-format has so many rules to configure. There is also the risk that team-members will get too defensive about their style in this setting. A holy war about code style will stop this initiative dead in its tracks.

But before discussions even start it would be nice to have a working example. Let's do that first.

## Adding Clang-format to your project with a default configuration
Before committing to any plan you can try out one of the default configurations for Clang-format.

1. Install clang-format. There are many ways to do this. When you install Clang-format make sure you can use it from bash (git bash is fine).
2. In the root of your repository execute `clang-format --style=LLVM --dump-config > .clang-format`. (Run `clang-format --help` if you want other options for `--style`)
3. Still in the same directory, execute `find \( -iname "*.c" -o -iname "*.C" -o -iname "*.c++" -o -iname "*.cc" -o -iname "*.cpp" -o -iname "*.cxx" -o -iname "*.hpp" -o -iname "*.h" -o -iname "*.hh" -o -iname "*.h++" -o -iname "*.hxx" \) -exec clang-format -i \{\} \+` \
"Now hold on, that's a very long and complicated command. I'm not just pasting that into my bash before I get it". I hear you think. Allow me to summarize: `find` is a command for finding files. The `\(` has a corresponding `\)` which is used to group together a condition. The condition here is "any C++ source file", so there are many possible file extensions.
`-exec` is an argument that tells `find` what to do for every file found. In this case `clang-format -i`. The `\{\}` part indicates where the argument will be placed. The `\+` indicates that all arguments may be added into one single command.
4. Optionally, put this command into an executable file `clang_format_all.sh`. This is how I do it for my own projects and also how I did it at work. I will assume you do this as well to make it easier to write my instructions.
