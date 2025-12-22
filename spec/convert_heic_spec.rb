# frozen_string_literal: true

require "fileutils"
require "open3"
require "rbconfig"
require "tmpdir"
require "rspec"

SCRIPT = File.expand_path("../scripts/convert_heic.rb", __dir__)
RUBY = RbConfig.ruby

RSpec.describe "convert_heic script" do
  before do
    skip "git not available" unless system("git", "--version", out: File::NULL, err: File::NULL)
  end

  def with_repo
    Dir.mktmpdir do |dir|
      FileUtils.mkdir_p(File.join(dir, "assets/images/dishes"))
      Dir.chdir(dir) { system("git", "init", "-q") }
      yield dir
    end
  end

  def write_file(path, content)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
  end

  def setup_fake_heif(dir)
    bin = File.join(dir, "bin")
    FileUtils.mkdir_p(bin)
    script = File.join(bin, "heif-convert")
    File.write(
      script,
      <<~SH
        #!/usr/bin/env bash
        if [[ "$1" == "--version" ]]; then
          echo "heif-convert 1.0"
          exit 0
        fi
        input="$1"
        output="$2"
        if [[ -z "$output" ]]; then
          echo "missing output" >&2
          exit 1
        fi
        echo "jpeg" > "$output"
        exit 0
      SH
    )
    FileUtils.chmod(0o755, script)
    bin
  end

  def run_script(dir, args: [], env: {})
    cmd = [RUBY, SCRIPT, *args]
    Open3.capture3(env, *cmd, chdir: dir)
  end

  it "returns status 1 when no HEIC is present in check-only mode" do
    with_repo do |dir|
      stdout, _stderr, status = run_script(dir, args: ["--check-only"])
      expect(status.exitstatus).to eq(1)
      expect(stdout).to eq("")

      heic = File.join(dir, "assets/images/dishes/sample.heic")
      write_file(heic, "heic")

      stdout, _stderr, status = run_script(dir, args: ["--check-only"])
      expect(status.exitstatus).to eq(0)
      expect(stdout).to eq("")
    end
  end

  it "converts HEIC files and updates tracked references" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      write_file(heic, "heic")

      yaml = File.join(dir, "_data/dishes.yml")
      html = File.join(dir, "index.html")
      txt = File.join(dir, "notes.txt")
      write_file(yaml, "src: /assets/images/dishes/sample.heic\n")
      write_file(html, '<img src="assets/images/dishes/sample.heic">')
      write_file(txt, "assets/images/dishes/sample.heic")

      Dir.chdir(dir) { system("git", "add", "-A") }

      bin = setup_fake_heif(dir)
      env = { "PATH" => "#{bin}:#{ENV.fetch("PATH", "")}" }
      _stdout, stderr, status = run_script(dir, env: env)

      expect(status.exitstatus).to eq(0), stderr
      expect(File).not_to exist(heic)
      expect(File).to exist(File.join(dir, "assets/images/dishes/sample.jpg"))
      expect(File.read(yaml)).to include("sample.jpg")
      expect(File.read(html)).to include("sample.jpg")
      expect(File.read(txt)).to include("sample.heic")
    end
  end

  it "skips conversion when jpg exists and overwrite is false" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      jpg = File.join(dir, "assets/images/dishes/sample.jpg")
      write_file(heic, "heic")
      write_file(jpg, "existing")

      yaml = File.join(dir, "_data/dishes.yml")
      write_file(yaml, "src: /assets/images/dishes/sample.heic\n")
      Dir.chdir(dir) { system("git", "add", "-A") }

      bin = setup_fake_heif(dir)
      env = { "PATH" => "#{bin}:#{ENV.fetch("PATH", "")}" }
      _stdout, _stderr, status = run_script(dir, env: env)

      expect(status.exitstatus).to eq(0)
      expect(File).to exist(heic)
      expect(File.read(jpg)).to eq("existing")
      expect(File.read(yaml)).to include("sample.heic")
    end
  end

  it "does not modify files during a dry run" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      write_file(heic, "heic")

      yaml = File.join(dir, "_data/dishes.yml")
      write_file(yaml, "src: /assets/images/dishes/sample.heic\n")
      Dir.chdir(dir) { system("git", "add", "-A") }

      _stdout, _stderr, status = run_script(dir, args: ["--dry-run"])

      expect(status.exitstatus).to eq(0)
      expect(File).to exist(heic)
      expect(File).not_to exist(File.join(dir, "assets/images/dishes/sample.jpg"))
      expect(File.read(yaml)).to include("sample.heic")
    end
  end

  it "overwrites existing jpg when overwrite flag is provided" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      jpg = File.join(dir, "assets/images/dishes/sample.jpg")
      write_file(heic, "heic")
      write_file(jpg, "old")

      yaml = File.join(dir, "_data/dishes.yml")
      write_file(yaml, "src: /assets/images/dishes/sample.heic\n")
      Dir.chdir(dir) { system("git", "add", "-A") }

      bin = setup_fake_heif(dir)
      env = { "PATH" => "#{bin}:#{ENV.fetch("PATH", "")}" }
      _stdout, stderr, status = run_script(dir, args: ["--overwrite"], env: env)

      expect(status.exitstatus).to eq(0), stderr
      expect(File).not_to exist(heic)
      expect(File.read(jpg)).to match(/jpeg/)
      expect(File.read(yaml)).to include("sample.jpg")
    end
  end

  it "updates custom extensions when provided" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      write_file(heic, "heic")

      notes = File.join(dir, "notes.txt")
      write_file(notes, "assets/images/dishes/sample.heic")
      Dir.chdir(dir) { system("git", "add", "-A") }

      bin = setup_fake_heif(dir)
      env = { "PATH" => "#{bin}:#{ENV.fetch("PATH", "")}" }
      _stdout, stderr, status = run_script(dir, args: ["--extensions", "txt"], env: env)

      expect(status.exitstatus).to eq(0), stderr
      expect(File.read(notes)).to include("sample.jpg")
    end
  end

  it "fails when heif-convert is missing" do
    with_repo do |dir|
      heic = File.join(dir, "assets/images/dishes/sample.heic")
      write_file(heic, "heic")
      Dir.chdir(dir) { system("git", "add", "-A") }

      env = { "PATH" => "" }
      _stdout, stderr, status = run_script(dir, env: env)

      expect(status.exitstatus).to eq(1)
      expect(stderr).to match(/heif-convert not found/i)
    end
  end
end
