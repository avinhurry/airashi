#!/usr/bin/env ruby
# frozen_string_literal: true

require "find"
require "open3"
require "optparse"
require "pathname"

options = {
  images_root: "assets/images",
  extensions: %w[
    .yml .yaml .md .markdown .html .json .liquid .scss .css .js .xml
  ],
  dry_run: false,
  overwrite: false,
  verbose: false,
  check_only: false,
}

OptionParser.new do |opts|
  opts.banner = "Usage: scripts/convert_heic.rb [options]"

  opts.on("--images-root PATH", "Images root (default: assets/images)") do |path|
    options[:images_root] = path
  end

  opts.on("--extensions x,y,z", Array, "Tracked extensions to update") do |list|
    options[:extensions] = list.map { |ext| ext.start_with?(".") ? ext.downcase : ".#{ext.downcase}" }
  end

  opts.on("--dry-run", "Do not modify files") { options[:dry_run] = true }
  opts.on("--overwrite", "Overwrite existing .jpg files") { options[:overwrite] = true }
  opts.on("--verbose", "Verbose logging") { options[:verbose] = true }
  opts.on("--check-only", "Exit 0 if HEIC/HEIF exists, 1 otherwise") { options[:check_only] = true }
end.parse!

def log(message, verbose: false, always: false)
  puts(message) if always || verbose
end

repo_root = Dir.pwd
begin
  stdout, status = Open3.capture2("git", "rev-parse", "--show-toplevel")
  repo_root = stdout.strip if status.success? && !stdout.strip.empty?
rescue Errno::ENOENT
  # git not available
end

root = Pathname.new(options[:images_root])
root = Pathname.new(repo_root).join(root) unless root.absolute?
unless root.exist?
  puts "Images root not found: #{root}"
  exit 0
end

heic_files = []
Find.find(root.to_s) do |path|
  next if File.directory?(path)
  ext = File.extname(path).downcase
  heic_files << path if ext == ".heic" || ext == ".heif"
end

if options[:check_only]
  exit heic_files.empty? ? 1 : 0
end

if heic_files.empty?
  puts "No HEIC/HEIF files found; skipping conversion."
  exit 0
end

unless options[:dry_run]
  ok = system("heif-convert", "--version", out: File::NULL, err: File::NULL)
  unless ok
    warn "heif-convert not found. Install libheif-examples."
    exit 1
  end
end

replacements = []
converted = 0
errors = 0

heic_files.each do |path|
  from = Pathname.new(path)
  to = from.sub_ext(".jpg")
  if to.exist? && !options[:overwrite]
    log("Skipping #{from} because #{to} already exists", verbose: options[:verbose], always: true)
    next
  end

  log("Converting #{from} -> #{to}", verbose: options[:verbose], always: true)
  unless options[:dry_run]
    ok = system("heif-convert", from.to_s, to.to_s)
    unless ok
      warn "Failed to convert #{from}"
      errors += 1
      next
    end

    if !to.exist? || to.size.to_i <= 0
      warn "Converted file #{to} is empty; keeping original."
      to.delete if to.exist?
      errors += 1
      next
    end

    from.delete
  end

  converted += 1

  rel_from = from.relative_path_from(Pathname.new(repo_root)).to_s
  rel_to = to.relative_path_from(Pathname.new(repo_root)).to_s
  replacements << [rel_from, rel_to]
end

begin
  stdout, status = Open3.capture2("git", "ls-files")
  tracked_files = status.success? ? stdout.lines.map(&:strip).reject(&:empty?) : []
rescue Errno::ENOENT
  tracked_files = []
end

if tracked_files.empty?
  puts "No tracked files found; skipping reference updates." if replacements.any?
else
  updated_files = 0
  extensions = options[:extensions].map(&:downcase)
  tracked_files.each do |rel|
    path = Pathname.new(repo_root).join(rel)
    next unless extensions.include?(path.extname.downcase)
    begin
      text = path.read(encoding: "UTF-8")
    rescue Encoding::InvalidByteSequenceError, Encoding::UndefinedConversionError
      next
    end
    updated = text.dup
    replacements.each do |old_path, new_path|
      updated = updated.gsub(old_path, new_path)
      updated = updated.gsub("/" + old_path, "/" + new_path)
    end
    next if updated == text
    if options[:dry_run]
      log("Would update reference in #{path}", verbose: options[:verbose], always: true)
    else
      path.write(updated)
      log("Updated reference in #{path}", verbose: options[:verbose], always: true)
    end
    updated_files += 1
  end
end

puts "Converted #{converted} HEIC file(s)."
exit errors.zero? ? 0 : 1
