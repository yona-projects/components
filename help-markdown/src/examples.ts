// help/markdown.html의 10개 예시(입력 마크다운 + 출력 HTML) 데이터.
//
// 원본은 대부분(8/10) `<div class="markdown-wrap" markdown="true">` 안에 원본 마크다운
// 텍스트를 그대로 심어두고, 사이트 전역 yona.Markdown.js(marked.js 클라이언트 렌더링)가
// 페이지 로드 시 그 자리에서 실제 HTML로 바꿔치기했다. 나머지 2개(체크리스트/짧은 링크)는
// 애초에 marked.js를 거치지 않고 출력 HTML을 직접 하드코딩해뒀다.
//
// 이 컴포넌트는 marked.js/hljs를 별도 런타임 의존성으로 들이지 않는다 - 이 패널이 보여주는
// 10개 예시는 절대 바뀌지 않는 고정 레퍼런스 문서이므로(사용자 입력을 렌더링하는 게 아님),
// "입력 텍스트 + 그 결과 HTML"을 전부 정적으로 하드코딩하는 원본의 후자 방식을 10개 전부로
// 확장했다 - 로직 동치성은 그대로 유지하면서 의존성만 없앤 것(원본에서 이미 쓰던 패턴의
// 일관된 확장이지, 새로운 접근이 아니다). marked.js가 실제로 저 입력들에 대해 만들어낼
// 출력과 동일하게 손으로 맞춰 썼다.
export interface MarkdownHelpExample {
  key: string;
  navLabel: string;
  input: string;
  outputHtml: string;
}

export const MARKDOWN_HELP_EXAMPLES: readonly MarkdownHelpExample[] = [
  {
    key: "markdownHeaders",
    navLabel: "Header",
    input: `# This is an H1
## This is an H2
### This is an H3`,
    outputHtml: `<h1>This is an H1</h1>
<h2>This is an H2</h2>
<h3>This is an H3</h3>`,
  },
  {
    key: "markdownStyling",
    navLabel: "Text Style",
    input: `*This is an italic*
**This is an bold**
~~This is an strike~~`,
    outputHtml: `<p><em>This is an italic</em>
<strong>This is an bold</strong>
<del>This is an strike</del></p>`,
  },
  {
    key: "markdownLinks",
    navLabel: "Link",
    input: `[Site](http://yobi.io/ "Yobi Site")

http://yobi.io/`,
    outputHtml: `<p><a href="http://yobi.io/" title="Yobi Site">Site</a></p>
<p><a href="http://yobi.io/">http://yobi.io/</a></p>`,
  },
  {
    key: "markdownLists",
    navLabel: "List",
    input: `- Red
    1. White
    2. Blue
- Green.`,
    outputHtml: `<ul>
<li>Red
<ol>
<li>White</li>
<li>Blue</li>
</ol>
</li>
<li>Green.</li>
</ul>`,
  },
  {
    // 원본도 marked.js를 거치지 않고 이 출력 HTML을 그대로 하드코딩해뒀다(2/10 중 하나) -
    // 그대로 이식.
    key: "markdownTaskList",
    navLabel: "Checklist",
    input: `- [ ] Todos
    - [x] To do A
    - [ ] To do B
    - [ ] To do C`,
    outputHtml: `<ul>
    <li>
        <input type="checkbox"> Todos
        <ul>
            <li><input type="checkbox" checked> To do A</li>
            <li><input type="checkbox"> To do B</li>
            <li><input type="checkbox"> To do C</li>
        </ul>
    </li>
</ul>`,
  },
  {
    key: "markdownImages",
    navLabel: "Image",
    input: `![title](https://repo.yona.io/assets/images/ico-like-small.png "Yobi")`,
    // 원본과 동일하게 실제로 화면에 뜨는 예시 이미지는 yona 자체 정적 에셋(/assets/images/...,
    // BootstrapSetupInterceptor 등이 아는 /static/ 별칭 경로)을 가리킨다 - 입력 예시의
    // repo.yona.io 절대경로를 그대로 쓰면 이 컴포넌트를 격리 실행할 때 깨진 이미지가 되므로,
    // 원본이 이미 그랬듯 실제 존재하는 상대경로로 보여준다(yona에 vendoring됐을 때만
    // 정상 표시 - 격리 데모에서는 원본도 이 예시만큼은 완전히 동일하게 보이지 않았다).
    outputHtml: `<p><img src="/assets/images/ico-like-small.png" alt="title" title="Yobi"></p>`,
  },
  {
    key: "markdownBlockquotes",
    navLabel: "Blockquote",
    input: `> Lorem ipsum dolor sit amet, consectetuer adipiscing elit.
>
> Aenean commodo ligula eget dolor.`,
    outputHtml: `<blockquote>
<p>Lorem ipsum dolor sit amet, consectetuer adipiscing elit.</p>
<p>Aenean commodo ligula eget dolor.</p>
</blockquote>`,
  },
  {
    key: "markdownCodes",
    navLabel: "Code",
    input: `\`function test() {console.log("hello world");}\`

\`\`\`javascript
function test() {
  console.log("hello world");
}
\`\`\``,
    outputHtml: `<p><code>function test() {console.log(&quot;hello world&quot;);}</code></p>
<pre><code class="javascript">function test() {
  console.log(&quot;hello world&quot;);
}
</code></pre>`,
  },
  {
    key: "markdownTables",
    navLabel: "Table",
    input: `| Default      | Align center | Align right |
| ------------ | :----------: | ------: |
| Carrot       | Red          | 1,000   |
| Banana       | Yellow       | 32,000  |`,
    outputHtml: `<table>
<thead>
<tr><th>Default</th><th align="center">Align center</th><th align="right">Align right</th></tr>
</thead>
<tbody>
<tr><td>Carrot</td><td align="center">Red</td><td align="right">1,000</td></tr>
<tr><td>Banana</td><td align="center">Yellow</td><td align="right">32,000</td></tr>
</tbody>
</table>
<p>Also, you can copy &amp; paste table from excel sheet</p>`,
  },
  {
    // 원본도 marked.js를 거치지 않고 이 출력 HTML을 그대로 하드코딩해뒀다(2/10 중 하나) -
    // 그대로 이식(데모용 외부 링크라 실제로 열리지는 않음 - 원본도 마찬가지).
    key: "markdownShortLinks",
    navLabel: "Short Link",
    input: `Issue no: #2
Mention: @yobi
commit: @763575 or @763575f177a4ce8b9370954de3ea1a1410205593`,
    outputHtml: `<p>Issue no: <a href="http://demo.yobi.io/yobi/yobi/issue/2">#2</a></p>
<p>Mention: <a href="http://demo.yobi.io/yobi">@yobi</a></p>
<p>commit: <a href="http://demo.yobi.io/yobi/yobi/commit/763575">@763575</a>  or
<a href="http://demo.yobi.io/yobi/yobi/commit/763575f177a4ce8b9370954de3ea1a1410205593">@763575</a></p>`,
  },
];
