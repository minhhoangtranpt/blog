---
layout: default
title: Trang Chủ
---

<h1>{{ site.title }}</h1>
<p>{{ site.description }}</p>

<h2>Bài Viết Mới Nhất</h2>
<ul>
  {% for post in site.posts %}
    <li>
      <h3>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </h3>
      <p>{{ post.excerpt }}</p>
      <p><small>Đăng ngày: {{ post.date | date: "%d/%m/%Y" }}</small></p>
    </li>
  {% endfor %}
</ul>
