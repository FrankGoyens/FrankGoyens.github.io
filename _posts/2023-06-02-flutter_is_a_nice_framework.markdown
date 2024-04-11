---
layout: post
title:  "Flutter is a nice framework"
date:   2023-06-02 21:20:00 +0100
categories: [App making]
---

{:refdef: style="text-align: center;"}
![Robofish expressing approval for the Flutter framework](/assets/img/robofish_flutter_like.png)
{: refdef}

Flutter is a framework that can be used to build cross platform apps. I’ve recently learned how to use it to make my app: “Reading Parrot Jacky”.

Flutter can be used for desktop apps and websites as well, but up until now I’ve used it to develop for Android and iOS. These are my experiences.

## Frameworks that I used before
Before I chose to use Flutter for my next project there were the usual doubts. I am already familiar with Cordova and Xamarin. It has been a while since I made a mobile app. I completely missed the rise of ReactNative. And now there are even more modern options outside of ReactNative.

So would I use a familiar framework? Try something new? Ionic is similar to the familiar Cordova. I heard good things about ReactNative. And also there is something called Flutter now?

I chose Flutter. It seemed a good idea to learn something new, to see what a newer framework has to offer compared to exising ones.

The choice wasn’t easy, it came down to a tie breaker. I eventually opted for Flutter because it “features” a strongly typed programming language. (I put *features* in quotes because some developers would prefer otherwise.) 

## Flutter hello world
The app that I decided to make plays a sound effect based on what you read. You would use the app while reading to your children, You may have heard of it already.

But first I made a “hello world” app with just one button and a text field showing a counter.

When you start a new Flutter project you get one *main.dart* file, along with some project files like Gradle build scripts. Dart is the programming language used to make Flutter apps. More on that later.

In *main.dart* there are three elements:

* A main function. This is already a good impression on my part. Having a simple main function even though it’s a mobile app. Because why not?
* A “MyApp” class representing a *Stateless Widget*. Every GUI element is a widget in Flutter, so the top-level app is one as well.
* A Stateful Widget called “ReadingParrot” in my case. A stateful widget is always paired with for instance a *_ReadingParrotState* class. It is a stateful widget because it changes its look and behavior according to the values in its state. 

Using Flutter’s *getting started* documentation, setting up a hello world app was a smooth process.

## Making the Reading Parrot GUI
I had already designed the GUI, now I wanted to implement it in Flutter.

{:refdef: style="text-align: center;"}
![An early screenshot of the Reading Parrot app](/assets/img/reading_parrot_sneakpeak.jpg)
{: refdef}

Here’s another great advantage of Flutter in my opinion: the GUI and the back-end logic are both in the same language: Dart. All within the same file even, if you want to.

You declare a GUI in Dart, which is a nested variable declaration. Variables would be of type `Row` or `Column` for layout-ing, `Button`, `Text`, `Icon`,… And when you instantiate a button object, you register Dart closures to its “on call” property to add behaviour.

Nesting variables to build a GUI gives an impression that it wouldn’t scale well. There is a nice solution for this: put GUI building code in their own separate functions, *duh*. In all seriousness though, in practice, nesting more and more variables as the GUI becomes more complex could get out of hand. My tip here is to make a separate functions as soon as possible, refactoring later on is rarely done. (This can be applied to any software project if you ask me.)

A small gripe to balance these impressions: setting margins doesn’t seem very intuitive. You would often add margins and padding to containers. The `Container` widget has a `margin` field, but you don’t simply enter numeric values therein, you have to instantiate an `EdgeInsets` object. `EdgeInsets`’s name doesn't really indicate “use this for padding and margins”. There are more examples like that, but nothing couldn’t be solved with a quick Google search.

## Plugins!
What’s a good framework without plugins? Even Cordova has them.

Plugins allow certain things to be used in a platform independant way, you would prefer to not write any code for a specific platform.

My reading parrot app would need:
* Speech recognition. There is a plugin ✅.
* Audio playback: There is a plugin ✅.
* Internet connectivity checks: There is a plugin ✅.

Installing a plugin can be done using `flutter pub add <plugin>`. Or you can add a statement to *pubspec.yaml* and then run `flutter pub get`.

No further comment needed here, the plugins I need are available and they were easy to install.

## GUI performance
A Flutter developer has good control over when there would be a GUI display update. 

Remember the stateful widget concept from earlier, when something changes in the corresponding *_state* object, you must call `setState()` to indicate that a frame update is necessary. You *must* indeed, because otherwise there wouldn’t be changes to what’s displayed. This gives you complete control in that regard, it’s definitely an advantage the way I see it.

Another interesting concept that I needed to apply for my reading parrot app: selectively updating the GUI, i.e. calling `setState()` for a subset of the GUI. I want to display the live microphone volume in the GUI, but I don’t want to rebuild the entire GUI for every volume update, of which there are many. Without going into too much detail, this is supported in Flutter.

Flutter GUI profiling is neatly integrated in Android Studio. I managed to confirm that the selective updates, mentioned in the previous paragraph, worked as intended.

Speaking of Android Studio…

## Flutter development in Android Studio
The Flutter framework is well integrated in Android Studio. These are some of the features:

* GUI profiling integration, as mentioned before.
* Hints about Dart conventions, which can be applied automatically in most cases. This is a tremendous help to cultivate good habits for a beginner.
* A hot-reload/hot-restart button. This is a great feature of Flutter in general, applying changes to dart code takes milliseconds to sync with an actual Android device.

It's almost boring, *almost*. But I have no further comments on this. Flutter development in Android Studio is going well for me.

## The Dart language

{:refdef: style="text-align: center;"}
![The Dart programming language logo](/assets/img/logo_lockup_dart_horizontal.png)
{:refdef}

Dart is a single-threaded, asynchronous, strongly-typed language. It being single threaded keeps things simple, while the asynchronous aspect (it has async/await mechanisms) makes it easy to prevent blocking the GUI rendering for longer background tasks.

Here are some technical details about the language:
* It is a strongly typed language, which makes development less error prone. There is also type deduction, you can just type `final x = calcX()` for instance.
* It supports runtime and static constants, both are checked during compilation.
* Dart handles null safety nicely. You can declare a type nullable and you must do a check before using the object, otherwise you get a compiler error. When you check whether a variable is null it is often automatically “promoted” into a non-nullable type.

It doesn’t have any new concepts compared to existing languages as far as I can tell though. Dart is a decent language nonetheless. But I find it strange that a framework would be built upon a lesser known programming language, one that is conceptually the same as other languages at surface level. That surely heightens the learning curve, you must learn both a framework and a language, because the Dart language is almost exclusively used for Flutter. But a programming language is just a tool at the end of the day.

The Flutter FAQ explains [why it chose to use Dart][flutter_faq_why_dart]. The criteria listed don’t seem to include whether the language is already used by many, they are more about the technical merit of the language itself.

From my experience: Dart reminds me of Kotlin in many ways. Dart comes off as "Kotlin light" the way I see it. If you have experience with Kotlin, that will likely transfer somewhat to Dart.

## In conclusion
I would recommend Flutter if someone is looking for a new framework to learn. 

Compared to the frameworks that I already knew, it offers simplicity by letting the developer create the GUI and behaviour all in the same language. It also offers modern features like hot-reload/hot-restart.

That being said, learning both a new framework and programming language can be daunting. For me it was worth learning nonetheless. I managed to make a nice app using it, if I do say so myself.

Besides, it could be used for web and desktop as well. Learning this framework offers many possibilities.

Thank you for reading about my thoughts and impressions on the Flutter framework. I hope it proves helpful to you!

[flutter_faq_why_dart]: https://docs.flutter.dev/resources/faq#why-did-flutter-choose-to-use-dart
