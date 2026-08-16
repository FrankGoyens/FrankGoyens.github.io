---
layout: page
title: MKitten(demo)
permalink: /mkitten_demo/
image: /assets/img/mkitten_capsule_megadrive.png
description: Play the MKitten demo in the browser, where you help MKitten reach the top! But watch out for traps!
---
<div class="mkitten-demo-layout">
  <div class="mkitten-demo-header">
    <div class="mkitten-demo-title-block">
      <p class="mkitten-demo-kicker">Now playing</p>
      <h2 class="mkitten-demo-heading">MKitten demo</h2>
    </div>

    <img src="/assets/img/mkitten_capsule_megadrive.png" alt="mkitten game box art in MegaDrive style" class="megadrive-boxart" />
  </div>

  <div class="mkitten-game-shell">
    {% include mkitten-demo.html %}
  </div>

  <div class="mkitten-forms-container">
    <div class="mkitten-signup-wrap">
      {% include kitten_game_mail_signup.html %}
    </div>
    
    <div class="mkitten-bug-form-wrap">
      {% include kitten_bug_report_form.html %}
    </div>
  </div>
</div>